import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/** Shows only in browsers that expose an install prompt for this PWA. */
export function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    const captureInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', captureInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', captureInstallPrompt);
  }, []);

  if (!installPrompt) return null;

  return (
    <Button
      variant="outline"
      size="icon"
      className="size-9 shrink-0"
      aria-label="Install Renegades Draft Central"
      title="Install app"
      onClick={async () => {
        await installPrompt.prompt();
        setInstallPrompt(null);
      }}
    >
      <Download className="size-4" />
    </Button>
  );
}
