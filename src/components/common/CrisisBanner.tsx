import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function CrisisBanner() {
  return (
    <Alert className="border-accent/40 bg-accent/10 text-foreground">
      <AlertTriangle className="text-accent size-4" />
      <AlertTitle>いのちや身体の安全が心配な内容が含まれています</AlertTitle>
      <AlertDescription className="text-muted-foreground mt-1 space-y-2 text-sm leading-relaxed">
        <p>
          つらさが強いときは、一人で抱えず、信頼できる窓口に声をかけてみてください。
        </p>
        <ul className="list-inside list-disc space-y-1">
          <li>
            <a
              href="https://www.inochinodenwa.org/"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              いのちの電話（24時間）
            </a>{" "}
            0120-783-556
          </li>
          <li>
            <a
              href="https://www.since2011.net/yorisoi/"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
              rel="noreferrer"
            >
              よりそいホットライン（24時間）
            </a>{" "}
            0120-279-338
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  );
}
