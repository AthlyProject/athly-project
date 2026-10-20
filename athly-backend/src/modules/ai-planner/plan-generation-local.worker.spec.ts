import { isLocalPlanGenerationEnabled } from './plan-generation-sqs.service';

describe('isLocalPlanGenerationEnabled', () => {
  const saved = { ...process.env };
  const setEnv = (env: Record<string, string | undefined>) => {
    for (const key of ['PLAN_GENERATION_INLINE', 'AWS_SQS_PLAN_GENERATION_QUEUE_URL', 'NODE_ENV']) {
      delete process.env[key];
    }
    Object.assign(process.env, env);
  };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('turns on only with the explicit opt-in outside production', () => {
    setEnv({ PLAN_GENERATION_INLINE: 'true', NODE_ENV: 'development' });
    expect(isLocalPlanGenerationEnabled()).toBe(true);
  });

  it.each([
    ['without the opt-in', { NODE_ENV: 'development' }],
    ['in production', { PLAN_GENERATION_INLINE: 'true', NODE_ENV: 'production' }],
    [
      'with SQS configured',
      {
        PLAN_GENERATION_INLINE: 'true',
        AWS_SQS_PLAN_GENERATION_QUEUE_URL: 'https://sqs.example/q',
      },
    ],
  ])('stays off %s', (_label, env) => {
    setEnv(env);
    expect(isLocalPlanGenerationEnabled()).toBe(false);
  });
});
