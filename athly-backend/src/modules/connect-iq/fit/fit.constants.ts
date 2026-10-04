/**
 * Versão do mapeamento treino → FIT. Entra no `rev` de cada treino: mudar aqui faz todos os
 * relógios baixarem os treinos de novo na próxima sincronização.
 */
export const ENCODER_VERSION = 1;

/**
 * Content-Type da resposta FIT. A Garmin não documenta o valor; um tipo recusado aparece no
 * relógio como -1002 (UNSUPPORTED_CONTENT_TYPE_IN_RESPONSE). Confirmado no spike (Phase 0).
 */
export const FIT_CONTENT_TYPE = 'application/vnd.ant.fit';

/**
 * Intensidade dos trechos de recuperação. `recovery` (4) é mais novo no perfil FIT; se algum
 * firmware não reconhecer, trocar para `rest`.
 */
export const RECOVERY_INTENSITY = 'recovery' as const;

/** Limites de texto: o relógio corta nomes longos e não tem glifo fora do Latin-1. */
export const MAX_WORKOUT_NAME_LENGTH = 24;
export const MAX_STEP_NAME_LENGTH = 20;
export const MAX_NOTES_LENGTH = 60;

/** Limite de passos do Garmin Connect (os passos de repetição contam). */
export const MAX_FIT_STEPS = 50;

/** Paces fora desta faixa (s/km) são lixo do gerador e viram alvo aberto. */
export const MIN_PACE_SEC_PER_KM = 150;
export const MAX_PACE_SEC_PER_KM = 1200;

/** Alvo de pace único vira faixa de ±10 s/km — mesma convenção do analisador de execução. */
export const SINGLE_PACE_PAD_SEC = 10;

/**
 * Byte de versão do protocolo no cabeçalho. O encoder JS grava 0x02; os SDKs oficiais (C/C#/
 * Swift) usam 0x10/0x20. Um treino só usa tipos do protocolo 1.0, então gravamos 0x10.
 */
export const FIT_PROTOCOL_VERSION = 0x10;

/** `product` do `file_id` para manufacturer `development`. */
export const FIT_PRODUCT_ID = 1;
