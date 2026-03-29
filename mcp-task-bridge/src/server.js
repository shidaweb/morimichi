/**
 * MCP Task Bridge Server
 *
 * Claude（Cowork）と Cursor の双方向タスク連携を実現する MCP サーバー。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import fs from 'fs'
import path from 'path'

// ============================================================
// Config
// ============================================================
const BRIDGE_DIR = process.env.BRIDGE_DIR || path.join(process.cwd(), '.bridge')
const TASKS_DIR = path.join(BRIDGE_DIR, 'tasks')
const RESULTS_DIR = path.join(BRIDGE_DIR, 'results')
const STATE_FILE = path.join(BRIDGE_DIR, 'state.json')

for (const dir of [BRIDGE_DIR, TASKS_DIR, RESULTS_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

// ============================================================
// State Management
// ============================================================
function loadState() {
  if (fs.existsSync(STATE_FILE)) {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))
  }
  const initial = {
    current_phase: 0,
    total_phases: 11,
    status: 'idle',
    history: [],
    created_at: new Date().toISOString(),
  }
  saveState(initial)
  return initial
}

function saveState(state) {
  state.updated_at = new Date().toISOString()
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2))
}

// ============================================================
// Task File Operations
// ============================================================
function createTask(task) {
  const id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  const taskData = {
    id,
    ...task,
    status: 'pending',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  fs.writeFileSync(path.join(TASKS_DIR, `${id}.json`), JSON.stringify(taskData, null, 2))
  return taskData
}

function getTask(id) {
  const file = path.join(TASKS_DIR, `${id}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

function updateTask(id, updates) {
  const task = getTask(id)
  if (!task) return null
  const updated = { ...task, ...updates, updated_at: new Date().toISOString() }
  fs.writeFileSync(path.join(TASKS_DIR, `${id}.json`), JSON.stringify(updated, null, 2))
  return updated
}

function listTasks(filter = {}) {
  const files = fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'))
  let tasks = files.map(f => JSON.parse(fs.readFileSync(path.join(TASKS_DIR, f), 'utf-8')))
  if (filter.status) tasks = tasks.filter(t => t.status === filter.status)
  if (filter.phase !== undefined) tasks = tasks.filter(t => t.phase === filter.phase)
  return tasks.sort((a, b) => a.created_at.localeCompare(b.created_at))
}

function saveResult(taskId, result) {
  const resultData = { task_id: taskId, ...result, created_at: new Date().toISOString() }
  fs.writeFileSync(path.join(RESULTS_DIR, `${taskId}.json`), JSON.stringify(resultData, null, 2))
  return resultData
}

function getResult(taskId) {
  const file = path.join(RESULTS_DIR, `${taskId}.json`)
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file, 'utf-8'))
}

// ============================================================
// MCP Server
// ============================================================
const server = new McpServer({
  name: 'task-bridge',
  version: '1.0.0',
  description: 'Claude ↔ Cursor 双方向タスク連携ブリッジ',
})

// ----------------------------------------------------------
// dispatch_task
// ----------------------------------------------------------
server.tool(
  'dispatch_task',
  'Phase ごとのタスクを投入する（Claude → Cursor）',
  {
    phase: z.number().describe('Phase番号 (1-11)'),
    title: z.string().describe('タスクタイトル'),
    prompt: z.string().describe('Cursorに渡すプロンプト（実装指示）'),
    priority: z.string().optional().default('high').describe('critical | high | medium | low'),
    depends_on: z.string().optional().default('').describe('依存タスクID（カンマ区切り）'),
    test_criteria: z.string().optional().default('').describe('完了判定テスト項目'),
  },
  async (params) => {
    const task = createTask({
      phase: params.phase,
      title: params.title,
      prompt: params.prompt,
      priority: params.priority || 'high',
      depends_on: params.depends_on ? params.depends_on.split(',').map(s => s.trim()).filter(Boolean) : [],
      test_criteria: params.test_criteria || '',
      dispatched_by: 'claude',
    })

    const state = loadState()
    state.status = 'running'
    state.current_phase = Math.max(state.current_phase, params.phase)
    state.history.push({
      action: 'dispatch', task_id: task.id, phase: params.phase,
      title: params.title, at: new Date().toISOString(),
    })
    saveState(state)

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true, task_id: task.id,
        message: `タスク "${params.title}" を Phase ${params.phase} に投入しました。`,
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// dispatch_phase_batch
// ----------------------------------------------------------
server.tool(
  'dispatch_phase_batch',
  'Phase 内の全タスクを一括投入する（Claude → Cursor）',
  {
    phase: z.number().describe('Phase番号 (1-11)'),
    tasks_json: z.string().describe('タスク配列のJSON [{title, prompt, test_criteria}, ...]'),
  },
  async (params) => {
    const tasks = JSON.parse(params.tasks_json)
    const created = []
    for (const t of tasks) {
      const task = createTask({
        phase: params.phase, title: t.title, prompt: t.prompt,
        priority: t.priority || 'high', depends_on: t.depends_on || [],
        test_criteria: t.test_criteria || '', dispatched_by: 'claude',
      })
      created.push(task)
    }
    const state = loadState()
    state.status = 'running'
    state.current_phase = Math.max(state.current_phase, params.phase)
    saveState(state)

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true, count: created.length,
        task_ids: created.map(t => t.id),
        message: `Phase ${params.phase} に ${created.length} 件のタスクを投入しました。`,
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// get_next_task
// ----------------------------------------------------------
server.tool(
  'get_next_task',
  'Cursor が次の未着手タスクを取得する',
  {},
  async () => {
    const pending = listTasks({ status: 'pending' })
    const completedIds = new Set(listTasks({ status: 'completed' }).map(t => t.id))
    const available = pending.filter(t => {
      if (!t.depends_on || t.depends_on.length === 0) return true
      return t.depends_on.every(dep => completedIds.has(dep))
    })

    if (available.length === 0) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: true, task: null, message: '現在実行可能なタスクはありません。',
        }, null, 2) }],
      }
    }

    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    available.sort((a, b) => (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2))
    const task = available[0]
    updateTask(task.id, { status: 'in_progress' })

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true,
        task: { id: task.id, phase: task.phase, title: task.title,
          prompt: task.prompt, priority: task.priority, test_criteria: task.test_criteria },
        message: `タスク "${task.title}" (Phase ${task.phase}) を開始してください。`,
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// report_result
// ----------------------------------------------------------
server.tool(
  'report_result',
  'Cursor が実装結果を報告する',
  {
    task_id: z.string().describe('完了したタスクのID'),
    status: z.string().describe('completed | failed | needs_review'),
    summary: z.string().describe('実装の概要'),
    files_changed: z.string().optional().default('').describe('変更したファイル一覧（改行区切り）'),
    issues: z.string().optional().default('').describe('発見した問題・懸念事項'),
    test_results: z.string().optional().default('').describe('テスト結果'),
  },
  async (params) => {
    const task = getTask(params.task_id)
    if (!task) {
      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: false, error: `タスク ${params.task_id} が見つかりません。`,
        }, null, 2) }],
      }
    }

    const newStatus = params.status === 'completed' ? 'completed'
      : params.status === 'failed' ? 'failed' : 'needs_fix'

    updateTask(params.task_id, { status: newStatus })
    saveResult(params.task_id, {
      status: params.status, summary: params.summary,
      files_changed: params.files_changed ? params.files_changed.split('\n').filter(Boolean) : [],
      issues: params.issues, test_results: params.test_results, reported_by: 'cursor',
    })

    const state = loadState()
    state.history.push({ action: 'report', task_id: params.task_id, status: params.status, at: new Date().toISOString() })
    saveState(state)

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true, message: `タスク "${task.title}" の結果を記録しました (${params.status})。`,
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// review_results
// ----------------------------------------------------------
server.tool(
  'review_results',
  'Claude が結果をレビューする',
  {
    phase: z.number().optional().default(0).describe('レビューする Phase 番号（0 = 全て）'),
  },
  async (params) => {
    const filter = params.phase > 0 ? { phase: params.phase } : {}
    const allTasks = listTasks(filter)
    const summary = {
      total: allTasks.length,
      pending: allTasks.filter(t => t.status === 'pending').length,
      in_progress: allTasks.filter(t => t.status === 'in_progress').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      failed: allTasks.filter(t => t.status === 'failed').length,
      needs_fix: allTasks.filter(t => t.status === 'needs_fix').length,
    }
    const details = allTasks.map(t => {
      const result = getResult(t.id)
      return {
        id: t.id, phase: t.phase, title: t.title, status: t.status,
        result: result ? { summary: result.summary, files_changed: result.files_changed,
          issues: result.issues, test_results: result.test_results } : null,
      }
    })

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true, summary, tasks: details, state: loadState(),
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// send_feedback
// ----------------------------------------------------------
server.tool(
  'send_feedback',
  'Claude が修正指示や承認を出す',
  {
    task_id: z.string().describe('修正対象タスクID'),
    feedback: z.string().describe('修正指示の詳細'),
    action: z.string().describe('approve | request_fix | reject'),
  },
  async (params) => {
    const task = getTask(params.task_id)
    if (!task) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'タスクが見つかりません' }, null, 2) }],
      }
    }

    if (params.action === 'approve') {
      updateTask(params.task_id, { status: 'completed', feedback: params.feedback })
    } else if (params.action === 'request_fix') {
      const fixTask = createTask({
        phase: task.phase,
        title: `[修正] ${task.title}`,
        prompt: `前回の実装 "${task.title}" に修正が必要です。\n\n## 修正指示\n${params.feedback}\n\n## 元のタスク内容\n${task.prompt}`,
        priority: 'critical', depends_on: [], test_criteria: task.test_criteria,
        dispatched_by: 'claude',
      })
      updateTask(params.task_id, { status: 'needs_fix', feedback: params.feedback })

      return {
        content: [{ type: 'text', text: JSON.stringify({
          success: true, fix_task_id: fixTask.id,
          message: `修正タスクを作成しました: ${fixTask.id}`,
        }, null, 2) }],
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: true, message: `タスク "${task.title}" を ${params.action} しました。`,
      }, null, 2) }],
    }
  }
)

// ----------------------------------------------------------
// get_dashboard
// ----------------------------------------------------------
server.tool(
  'get_dashboard',
  '全体進捗ダッシュボードを表示する',
  {},
  async () => {
    const state = loadState()
    const allTasks = listTasks()
    const phaseStats = {}
    for (let i = 1; i <= 11; i++) {
      const phaseTasks = allTasks.filter(t => t.phase === i)
      phaseStats[`Phase ${i}`] = {
        total: phaseTasks.length,
        completed: phaseTasks.filter(t => t.status === 'completed').length,
        pending: phaseTasks.filter(t => t.status === 'pending').length,
        in_progress: phaseTasks.filter(t => t.status === 'in_progress').length,
        failed: phaseTasks.filter(t => t.status === 'failed' || t.status === 'needs_fix').length,
      }
    }

    return {
      content: [{ type: 'text', text: JSON.stringify({
        status: state.status, current_phase: state.current_phase,
        phases: phaseStats, recent_activity: state.history.slice(-10),
        updated_at: state.updated_at,
      }, null, 2) }],
    }
  }
)

// ============================================================
// Start Server
// ============================================================
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[Task Bridge] MCP Server started')
