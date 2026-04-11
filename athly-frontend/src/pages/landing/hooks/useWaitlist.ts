import { useState } from 'react';
import { submitWaitlist } from '@/services/waitlistService';

export function useWaitlist() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await submitWaitlist({ name: name.trim(), email: email.trim().toLowerCase() });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  return { name, setName, email, setEmail, loading, success, error, handleSubmit };
}
