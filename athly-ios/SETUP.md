# Configuração do Athly Runner (Xcode)

## Erro: "The app identifier com.athly.runner cannot be registered to your development team"

Esse erro aparece quando o Bundle ID já está registrado na conta/equipe de outro desenvolvedor. Você pode resolver de duas formas:

### Opção 1: Usar a mesma equipe (recomendado se trabalharem juntos)

Quem criou o projeto (dono da conta onde `com.athly.runner` está registrado) deve:

1. Acessar [Apple Developer](https://developer.apple.com/account) → **People** → **Invite People**.
2. Convidar o colega com o e-mail da Apple ID dele.
3. O colega aceita o convite e, no Xcode, em **Signing & Capabilities**, escolhe o **Team** correspondente.

Assim os dois usam o mesmo Bundle ID e o mesmo perfil de provisionamento.

### Opção 2: Usar um Bundle ID próprio (cada um na sua conta)

Se você usa outra Apple Developer account / team:

1. Crie o arquivo `Config/User.xcconfig` (na pasta `athly-ios`) com uma única linha:

   ```
   ATHLY_BUNDLE_ID = com.athly.runner.dev
   ```

   (Pode usar outro sufixo, por exemplo `com.athly.runner.seudonome`.)

2. Esse arquivo já está no `.gitignore`, então não será commitado.

3. Gere o projeto de novo: `xcodegen generate` (na pasta `athly-ios`).

4. Abra o projeto no Xcode e selecione seu **Team** em **Signing & Capabilities**.

O app passará a usar o Bundle ID definido em `User.xcconfig` em vez de `com.athly.runner`.
