import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { User, Zap, Dumbbell, Flame, Star, Mail, Target, CalendarDays, Save, Settings, LogOut, Activity, Bike } from 'lucide-react'
import { Card, GradientText, Badge, Divider, StatCard } from '@/components/ui'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Section } from '@/components/layout'
import { useAuthStore } from '@/store/authStore'
import { getProfile, updateProfile } from '@/services/profileService'
import toast from 'react-hot-toast'

const WEEKDAYS = [
  { key: 'monday', label: 'Seg' },
  { key: 'tuesday', label: 'Ter' },
  { key: 'wednesday', label: 'Qua' },
  { key: 'thursday', label: 'Qui' },
  { key: 'friday', label: 'Sex' },
  { key: 'saturday', label: 'Sab' },
  { key: 'sunday', label: 'Dom' },
]

export function ProfilePage() {
  const navigate = useNavigate()
  const { user, setUser, logout } = useAuthStore()
  const [name, setName] = useState(user?.name ?? '')
  const [goals, setGoals] = useState(user?.goals?.join(', ') ?? '')
  const [availableDays, setAvailableDays] = useState<string[]>(user?.availableDays ?? [])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getProfile().then((profile) => {
      setUser(profile)
      setName(profile.name)
      setGoals(profile.goals?.join(', ') ?? '')
      setAvailableDays(profile.availableDays ?? [])
    })
  }, [setUser])

  function toggleDay(day: string) {
    setAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const updated = await updateProfile({
        name,
        goals: goals.split(',').map((g) => g.trim()).filter(Boolean),
        availableDays,
      })
      setUser(updated)
      toast.success('Perfil atualizado!')
    } catch {
      toast.error('Erro ao atualizar perfil')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Section spacing="md">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full gradient-primary flex items-center justify-center glow-primary">
            <User className="h-10 w-10 text-white" />
          </div>
          <div className="flex-1">
            <GradientText variant="primary">
              <h1 className="text-3xl font-bold">{user?.name || 'Perfil'}</h1>
            </GradientText>
            <p className="text-[var(--color-text-secondary)] mt-1">
              {user?.email}
            </p>
            <Badge variant="neon" size="sm" className="mt-2">
              <Zap className="h-3 w-3 inline mr-1" />Atleta Premium
            </Badge>
          </div>
        </div>
      </Section>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard
          label="Treinos"
          value="142"
          icon={<Dumbbell className="h-5 w-5" />}
          gradient
        />
        <StatCard
          label="Sequência"
          value="28 dias"
          icon={<Flame className="h-5 w-5" />}
          badge={{ text: 'Recorde!', variant: 'success' }}
        />
        <StatCard
          label="Nível"
          value="Avançado"
          icon={<Star className="h-5 w-5" />}
        />
      </div>

      <Divider variant="gradient" />

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <Section title="Informações Pessoais" spacing="md">
          <Card padding="lg">
            <div className="space-y-4">
              <Input
                label="Nome"
                value={name}
                onChange={(e) => setName(e.target.value)}
                icon={<User className="h-4 w-4" />}
              />
              <Input
                label="Email"
                type="email"
                value={user?.email ?? ''}
                disabled
                icon={<Mail className="h-4 w-4" />}
              />
            </div>
          </Card>
        </Section>

        <Section title="Objetivos de Treino" subtitle="O que você deseja alcançar?" spacing="md">
          <Card padding="lg">
            <Input
              label="Seus objetivos"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="Melhorar resistência, Perder peso, Ganhar massa..."
              icon={<Target className="h-4 w-4" />}
            />
            <p className="mt-2 text-sm text-[var(--color-text-tertiary)]">
              Separe múltiplos objetivos por vírgula
            </p>
          </Card>
        </Section>

        <Section title="Dias de Treino" subtitle="Quais dias da semana você pode treinar?" spacing="md">
          <Card padding="lg">
            <div className="flex items-center gap-2 mb-3">
              <CalendarDays className="h-4 w-4 text-[var(--color-text-secondary)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                {availableDays.length} {availableDays.length === 1 ? 'dia' : 'dias'} selecionado{availableDays.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex gap-2 flex-wrap">
              {WEEKDAYS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => toggleDay(key)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-all ${
                    availableDays.includes(key)
                      ? 'gradient-primary text-white glow-primary'
                      : 'bg-[var(--color-surface-dark)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-card)]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Card>
        </Section>

        <Section title="Modalidades Favoritas" spacing="md">
          <Card padding="lg">
            <p className="text-[var(--color-text-secondary)] mb-4">
              Personalizado de acordo com suas preferências
            </p>
            <div className="flex flex-wrap gap-2">
              <Badge variant="primary"><Activity className="h-3 w-3 inline mr-1" />Corrida</Badge>
              <Badge variant="secondary"><Bike className="h-3 w-3 inline mr-1" />Ciclismo</Badge>
              <Badge variant="success"><Dumbbell className="h-3 w-3 inline mr-1" />Força</Badge>
              <Badge variant="primary"><Star className="h-3 w-3 inline mr-1" />Yoga</Badge>
            </div>
          </Card>
        </Section>

        <Divider variant="gradient" />

        {/* Actions */}
        <div className="space-y-4">
          <Button type="submit" variant="gradient" fullWidth size="lg" loading={loading} glow>
            <Save className="h-5 w-5 inline mr-2" />Salvar alterações
          </Button>

          <Link to="/app/settings" className="block">
            <Button variant="outline" fullWidth size="lg">
              <Settings className="h-5 w-5 inline mr-2" />Configurações e integrações
            </Button>
          </Link>

          <Button
            type="button"
            variant="danger"
            fullWidth
            onClick={() => {
              if (confirm('Tem certeza que deseja sair?')) {
                logout()
                navigate('/login')
              }
            }}
          >
            <LogOut className="h-5 w-5 inline mr-2" />Sair da conta
          </Button>
        </div>
      </form>
    </div>
  )
}
