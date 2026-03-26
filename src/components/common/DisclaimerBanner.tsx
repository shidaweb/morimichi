import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DisclaimerBanner() {
  return (
    <Alert className="border-border/80 bg-muted/30">
      <AlertTitle>ご利用上のお願い</AlertTitle>
      <AlertDescription className="text-muted-foreground text-sm leading-relaxed">
        掲載される内容は個人の経験や感想であり、正確性・完全性は保証されません。法的・税務・金融などの判断は、必ず有資格の専門家にご相談ください。
      </AlertDescription>
    </Alert>
  );
}
