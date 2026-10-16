DEVICE ?= fr57042mm
KEY ?= $(HOME)/.garmin/athly_ciq.der

.PHONY: build iq field-build field-iq field-test app-build app-iq app-test

# Compila o .prg (release) para um relógio: make build DEVICE=fr970
build:
	monkeyc -f monkey.jungle -d $(DEVICE) -o bin/athly.prg -y $(KEY) -r

# Gera o pacote .iq para a Connect IQ Store (todos os relógios do manifest)
iq:
	monkeyc -f monkey.jungle -e -r -o bin/athly.iq -y $(KEY)

# Campo de dados (field/): .prg release para um relógio: make field-build DEVICE=fr970
# O .prg vai para GARMIN/APPS no relógio (ver "Campo de dados" no README).
field-build:
	cd field && monkeyc -f monkey.jungle -d $(DEVICE) -o bin/field.prg -y $(KEY) -r

# Pacote .iq do campo de dados para a Connect IQ Store
field-iq:
	cd field && monkeyc -f monkey.jungle -e -r -o bin/field.iq -y $(KEY)

# Testes unitários do campo no simulador (abra antes com `connectiq &`). O monkeydo sai com 1 mesmo
# quando tudo passa, então o resultado vem da linha PASSED.
field-test:
	cd field && monkeyc -f monkey.jungle -d $(DEVICE) -o bin/test.prg -y $(KEY) --unit-test
	@cd field && out="$$(monkeydo bin/test.prg $(DEVICE) -t 2>&1)"; echo "$$out"; echo "$$out" | grep -q '^PASSED'

# App único (app/): roda o treino, grava e envia para a Athly. Mesmo ID do app de treinos 1.x.
# make app-build DEVICE=fr970 → app/bin/athly.prg, copiar para GARMIN/APPS no lugar do athly.prg antigo
app-build:
	cd app && monkeyc -f monkey.jungle -d $(DEVICE) -o bin/athly.prg -y $(KEY) -r

app-iq:
	cd app && monkeyc -f monkey.jungle -e -r -o bin/athly.iq -y $(KEY)

# Testes unitários do app no simulador (abra antes com `connectiq &`)
app-test:
	cd app && monkeyc -f monkey.jungle -d $(DEVICE) -o bin/test.prg -y $(KEY) --unit-test
	@cd app && out="$$(monkeydo bin/test.prg $(DEVICE) -t 2>&1)"; echo "$$out"; echo "$$out" | grep -q '^PASSED'
