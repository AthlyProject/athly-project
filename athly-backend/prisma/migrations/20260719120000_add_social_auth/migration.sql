-- Contas sociais (Apple/Google) não têm senha.
ALTER TABLE "users" ALTER COLUMN "password" DROP NOT NULL;

-- Identificadores estáveis dos provedores sociais.
ALTER TABLE "users" ADD COLUMN "apple_user_id" TEXT;
ALTER TABLE "users" ADD COLUMN "google_user_id" TEXT;

CREATE UNIQUE INDEX "users_apple_user_id_key" ON "users"("apple_user_id");
CREATE UNIQUE INDEX "users_google_user_id_key" ON "users"("google_user_id");
