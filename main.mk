# put here initial configurations
main: ${ID_RSA} ${LOWSEC_ID_RSA} zsh

.PHONY: main

ID_RSA:${HOME}/.ssh/id_rsa
#passwordless id_rsa for automated jobs
LOWSEC_ID_RSA=${HOME}/.ssh/lowsec_id_rsa

${ID_RSA}:
	@echo "this will be your main key. use a secure password"
	ssh-keygen -f ${ID_RSA}

${LOWSEC_ID_RSA}:${ID_RSA}
	@echo "this will be the key for automated jobs. no password needed"
	ssh-keygen -f ${LOWSEC_ID_RSA}
