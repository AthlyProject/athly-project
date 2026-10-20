/**
 * Cenários locais do planner. Uso, em athly-backend (via ./cenarios.sh):
 *   seed                      cria/atualiza as 3 contas, sem meta
 *   reset <cenario|todos>     apaga meta e plano para refazer o onboarding
 *   acompanhar                mostra cada geração ao vivo e salva prompt/resposta
 *   exportar <cenario|todos>  salva as gerações que ainda estão no banco
 *   eval [perfil] [opções]    roda a suíte de evals (ver README.md); sai com 1 se algum caso falhar
 */
import { CENARIOS, Cenario, SAIDA, acompanhar, exportar, prisma, reset, seed } from './base';
import { lerOpcoes, rodarEval } from './eval/index';

function cenariosDoArgumento(arg: string | undefined): Cenario[] {
  if (arg === 'todos') return [...CENARIOS];
  if (CENARIOS.includes(arg as Cenario)) return [arg as Cenario];
  throw new Error(`Informe um cenário: ${CENARIOS.join(', ')} ou todos.`);
}

async function main() {
  const [comando, arg, ...resto] = process.argv.slice(2);
  switch (comando) {
    case 'seed':
      return seed();
    case 'reset':
      for (const cenario of cenariosDoArgumento(arg)) await reset(cenario);
      return;
    case 'exportar':
      for (const cenario of cenariosDoArgumento(arg)) await exportar(cenario);
      console.log(`Gerações salvas em ${SAIDA}`);
      return;
    case 'acompanhar':
      return acompanhar();
    case 'eval': {
      const passou = await rodarEval(lerOpcoes([arg, ...resto].filter((a) => a !== undefined)));
      if (!passou) process.exitCode = 1;
      return;
    }
    default:
      throw new Error(
        'Comandos: seed | reset <cenario|todos> | acompanhar | exportar <cenario|todos> | eval [perfil] [--tag x] [--caso id] [--repetir N] [--max-usd X] [--listar]',
      );
  }
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
