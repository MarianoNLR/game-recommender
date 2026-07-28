import CreateGroupForm from './CreateGroupForm'

export default function CreateGroupPage() {
  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold text-foreground">Crear grupo</h1>
        <p className="text-muted-foreground">
          Agregá los SteamIDs de los miembros del grupo
        </p>
      </div>
      <CreateGroupForm />
    </main>
  )
}