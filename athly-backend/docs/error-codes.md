# Códigos de erro da API

Mensagens de erro chegam ao usuário final no app, e o app fala pt-BR, inglês e alemão. Em vez
de traduzir no servidor, a API devolve um **código estável** e cada cliente resolve esse código
no próprio catálogo de strings — a tradução fica junto do resto da UI, e o servidor não precisa
negociar idioma.

## Formato da resposta

Erros de negócio mantêm o corpo do Nest e acrescentam `code`:

```json
{
  "statusCode": 401,
  "error": "Unauthorized",
  "code": "AUTH_INVALID_CREDENTIALS",
  "message": "Credenciais inválidas"
}
```

Erros de validação (`class-validator`) usam `code: "VALIDATION_FAILED"` e detalham campo a campo
em `errors`. `message` continua sendo o `string[]` de antes:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "code": "VALIDATION_FAILED",
  "message": ["Senha deve ter no mínimo 8 caracteres"],
  "errors": [
    {
      "field": "password",
      "constraint": "minLength",
      "code": "VALIDATION_PASSWORD_MIN_LENGTH",
      "message": "Senha deve ter no mínimo 8 caracteres"
    }
  ]
}
```

`message` segue em pt-BR e não vai sumir: é o fallback de quem não conhece o código (app antigo
contra backend novo, web, Android) e o texto que aparece nos logs.

## Como os códigos de validação são derivados

`VALIDATION` + caminho do campo + nome da constraint, tudo em `SCREAMING_SNAKE_CASE`. Índices de
array saem do código mas ficam em `field`:

| `field`              | `constraint` | `code`                                |
| -------------------- | ------------ | ------------------------------------- |
| `email`              | `isEmail`    | `VALIDATION_EMAIL_IS_EMAIL`           |
| `password`           | `minLength`  | `VALIDATION_PASSWORD_MIN_LENGTH`      |
| `blocks.0.duration`  | `isNumber`   | `VALIDATION_BLOCKS_DURATION_IS_NUMBER` |

Ou seja: o código sai de graça do DTO, sem tabela paralela para manter. Em compensação, **o
código muda se o campo ou a constraint mudarem de nome** — renomear um campo de DTO é uma
quebra de contrato, trate como tal.

## Onde mexer

| O quê | Onde |
| ----- | ---- |
| Lista de códigos | `src/common/errors/error-codes.ts` |
| Exceções que carregam código | `src/common/errors/coded-exception.ts` |
| Derivação dos códigos de validação | `src/common/errors/validation-exception.factory.ts` |
| Tradução no app iOS | `athly-ios/AthlyRunner/Services/BackendErrorCode.swift` |
| Strings do app iOS | `athly-ios/AthlyRunner/Resources/Localizable.xcstrings` |

## Ao adicionar um erro

1. Acrescente o código em `error-codes.ts`.
2. Lance uma `Coded*Exception` com esse código e o texto pt-BR.
3. Se o erro aparece para o usuário no app, mapeie o código em `BackendErrorCode.swift` e
   adicione a string (pt-BR/en/de) ao catálogo.

Pular o passo 3 não quebra nada: o app cai no `message` em pt-BR.

**Código publicado não muda de nome.** Clientes já instalados mapeiam pelo nome antigo; para um
significado novo, crie um código novo.
