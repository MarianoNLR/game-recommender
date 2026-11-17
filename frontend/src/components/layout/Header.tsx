import { Link } from 'react-router-dom';
import { HomeIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function Header() {
  return (
    <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-full max-w-7xl items-center px-4">
        <Link
          to="/"
          aria-label="Volver al inicio"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-lg' }))}
        >
          <HomeIcon className="size-5" />
        </Link>
      </div>
    </header>
  );
}
