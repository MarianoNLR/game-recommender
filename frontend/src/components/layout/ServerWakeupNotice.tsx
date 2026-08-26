import { Info } from 'lucide-react';

export function ServerWakeupNotice() {
  return (
    <div className="w-full border-b bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-7xl items-center text-center justify-center gap-2">
        <Info className="h-4 w-4 shrink-0" />
        <p>
          La primera carga puede tardar unos segundos mientras se inicia el servidor.
        </p>
      </div>
    </div>
  );
}