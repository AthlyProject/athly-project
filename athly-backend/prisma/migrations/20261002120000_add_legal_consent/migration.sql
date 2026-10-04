-- Aceite legal (Termos de Uso / Política de Privacidade) com data e versão de cada documento.
ALTER TABLE "users" ADD COLUMN "terms_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "terms_version" TEXT;
ALTER TABLE "users" ADD COLUMN "privacy_accepted_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "privacy_version" TEXT;
