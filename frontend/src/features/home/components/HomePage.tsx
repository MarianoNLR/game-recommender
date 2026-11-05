import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowRight, Eye } from "lucide-react";
import { EXAMPLE_ACCESS_CODE } from "@/lib/config";

export default function HomePage() {
  const [accessCode, setAccessCode] = useState("");
  const navigate = useNavigate();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (accessCode.trim()) {
      navigate(`/recommendations/${accessCode.trim()}`);
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4 gap-12">
      <div className="text-center space-y-4 max-w-xl">
        <h1 className="text-4xl font-bold tracking-tight text-foreground">
          Encontrá juegos para tu grupo
        </h1>
        <p className="text-muted-foreground text-lg">
          Ingresá los SteamIDs de tu grupo y te mostramos juegos según los
          gustos de todos
        </p>
      </div>
      <Button
        className="w-full max-w-xs cursor-pointer"
        size="lg"
        onClick={() => navigate("/create-group")}
      >
        Crear grupo
      </Button>
      {EXAMPLE_ACCESS_CODE && (
        <Button
          variant="secondary"
          className="w-full max-w-xs cursor-pointer -mt-8"
          size="lg"
          onClick={() => navigate(`/recommendations/${EXAMPLE_ACCESS_CODE}`)}
        >
          <Eye className="h-4 w-4" />
          Ver ejemplo
        </Button>
      )}
      <div className="flex flex-col items-center gap-2">
        <span className="text-muted-foreground text-sm">
          ¿Ya tenés un código?
        </span>
        <form onSubmit={handleCodeSubmit} className="flex gap-2">
          <Input
            placeholder="Ingresá el código"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            className="w-56"
          />
          <Button type="submit" variant="outline" className="cursor-pointer">
            <ArrowRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </main>
  );
}
