DEVICE ?= fr57042mm
KEY ?= $(HOME)/.garmin/athly_ciq.der

.PHONY: build iq

# Compila o .prg (release) para um relógio: make build DEVICE=fr970
build:
	monkeyc -f monkey.jungle -d $(DEVICE) -o bin/athly.prg -y $(KEY) -r

# Gera o pacote .iq para a Connect IQ Store (todos os relógios do manifest)
iq:
	monkeyc -f monkey.jungle -e -r -o bin/athly.iq -y $(KEY)
