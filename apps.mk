git: stamps/git

stamps/git:
	sudo apt-get install -y git
	git config --global core.editor "vim"
	rm -f ${HOME}/.gitignore
	ln -s ${PWD}/data/gitignore ${HOME}/.gitignore
	git config --global core.excludesfile ~/.gitignore
	touch $@

ocaml: stamps/ocaml

stamps/ocaml:
	sudo apt-get install -y ocaml opam
	opam init
	touch $@

vim: stamps/vim

stamps/vim:
	sudo apt-get install -y vim ctags
	git clone --recursive git@github.com:waneck/vimrc-1.git ${HOME}/.vim_runtime
	ln -s ${PWD}/data/my_configs.vim ${HOME}/.vim_runtime
	sh ${HOME}/.vim_runtime/install_awesome_vimrc.sh

stamps/gvim: stamps/vim
	sudo apt-get install -y vim-gtk

#zsh
zsh: git ${HOME}/.oh-my-zsh stamps/zsh

${HOME}/.oh-my-zsh:
	rm -f ${HOME}/.zshrc
	ln -s ${PWD}/data/zshrc ${HOME}/.zshrc
	git clone https://github.com/robbyrussell/oh-my-zsh.git ${HOME}/.oh-my-zsh

stamps/zsh:
	sudo apt-get install -y zsh
	sudo chsh -s /bin/zsh ${USER}
	touch $@

.PHONY: zsh ocaml git
