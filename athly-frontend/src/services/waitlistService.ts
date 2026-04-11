const BASE_URL = import.meta.env.VITE_BACKEND_API_URL;

interface WaitlistEntry {
  name: string;
  email: string;
}

interface WaitlistResponse {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export async function submitWaitlist(data: WaitlistEntry): Promise<WaitlistResponse> {
  const response = await fetch(`${BASE_URL}/waitlist`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (response.status === 409) {
    throw new Error('Este email já está na lista de espera.');
  }

  if (!response.ok) {
    throw new Error('Erro ao cadastrar. Tente novamente.');
  }

  return response.json();
}
