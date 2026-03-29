"use client";

import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type Props = {
  markdown: string;
  className?: string;
};

export function ArticleContent({ markdown, className }: Props) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children, ...rest }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
              {children}
            </a>
          ),
          img: ({ src, alt, ...rest }) => (
            // eslint-disable-next-line @next/next/no-img-element -- ユーザー投稿マークダウン内の画像
            <img
              src={src}
              alt={alt ?? ""}
              className="my-3 h-auto max-w-full rounded-md border"
              loading="lazy"
              {...rest}
            />
          ),
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
