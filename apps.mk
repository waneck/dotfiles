apps: git ocaml vim zsh dev stamps/keepass google-earth stamps/sparkleshare

dev: stamps/java stamps/mono stamps/devmisc ocaml

git: stamps/git

stamps/git:
	sudo apt-get install -y git
	git config --global core.editor "vim"
	rm -f ${HOME}/.gitignore
	ln -s ${PWD}/data/gitignore ${HOME}/.gitignore
	git config --global core.excludesfile ~/.gitignore
	touch $@

ocaml: stamps/ocaml stamps/camlp4 stamps/opam

stamps/ocaml:
	# install ocaml from sources to get ocamlopt.opt
	- sudo apt-get remove --purge ocaml opam
	wget http://caml.inria.fr/pub/distrib/ocaml-4.02/ocaml-4.02.2.tar.xz -O /tmp/ocaml.tar.xz
	cd /tmp && tar -xvf ocaml.tar.xz && cd ocaml-4.02.2 && ./configure --prefix /usr && make world.opt && sudo make install
	# I don't know why anyone would prefer ocamlopt over ocamlopt.opt
	# hmm. maybe this https://xkcd.com/303/
	sudo mv /usr/bin/ocamlopt /usr/bin/ocamlopt.nopt
	sudo cp /usr/bin/ocamlopt.opt /usr/bin/ocamlopt
	sudo mv /usr/bin/ocamlc /usr/bin/ocamlc.nopt
	sudo cp /usr/bin/ocamlc.opt /usr/bin/ocamlc
	sudo mv /usr/bin/ocamllex /usr/bin/ocamllex.nopt
	sudo cp /usr/bin/ocamllex.opt /usr/bin/ocamllex
	touch $@

stamps/camlp4: stamps/ocaml
	wget https://github.com/ocaml/camlp4/archive/4.02+6.tar.gz -O /tmp/camlp4.tgz
	cd /tmp && tar -xvf camlp4.tgz && cd camlp4-4.02-6 && ./configure && make && sudo make install
	touch $@

stamps/opam: stamps/ocaml
	# install opam
	wget https://github.com/ocaml/opam/archive/1.2.2.tar.gz -O /tmp/opam.tar.gz
	cd /tmp && tar -xvf opam.tar.gz && cd opam-1.2.2 && ./configure --prefix /usr && make lib-ext && make && sudo make install
	opam init
	touch $@

vim: stamps/vim stamps/gvim stamps/youcompleteme

stamps/youcompleteme:stamps/vim
	cd ${HOME}/.vim_runtime/sources_non_forked/youcompleteme && ./install.sh --clang-completer
	touch $@

stamps/vim:
	sudo apt-get install -y vim ctags
	git clone --recursive https://github.com/waneck/vimrc-1.git ${HOME}/.vim_runtime
	ln -s ${PWD}/data/my_configs.vim ${HOME}/.vim_runtime
	sh ${HOME}/.vim_runtime/install_awesome_vimrc.sh
	sudo apt-get install -y build-essential cmake python-dev
	touch $@

stamps/gvim: stamps/vim
	sudo apt-get install -y vim-gtk
	touch $@

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

stamps/java:
	sudo apt-get install -y openjdk-7-jdk eclipse
	touch $@

stamps/mono:
	sudo apt-get install -y mono-complete monodevelop
	touch $@

stamps/devmisc:
	sudo apt-get -y install php5-cli sqlite3 libsqlite3-0
	wget -O /tmp/sqlitestudio http://sqlitestudio.pl/files/free/stable/linux64/sqlitestudio-2.1.4.bin
	sudo cp /tmp/sqlitestudio /usr/bin
	sudo chmod +x /usr/bin/sqlitestudio
	sudo cp data/desktop/sqlitestudio.desktop /usr/share/applications/
	touch $@

KEEPASS=/usr/lib/keepass2/

stamps/keepass:
	sudo apt-get -y install keepass2
	sudo mkdir -p ${KEEPASS}/plugins
	#otp
	@echo "https://bitbucket.org/devinmartin/keeotp/wiki/Home"
	wget https://bitbucket.org/devinmartin/keeotp/downloads/KeeOtp-1.3.1-Full.zip -O /tmp/otp.zip
	rm -rf /tmp/otp
	mkdir -p /tmp/otp && cd /tmp/otp && unzip ../otp.zip
	sudo cp -rf /tmp/otp/* ${KEEPASS}/plugins
	touch $@

stamps/hexchat:
	sudo apt-get -y install hexchat
	touch $@

google-earth: stamps/google-earth

stamps/google-earth:
	# sudo apt-get -y install libgtk2.0-0:i386 libx11-6:i386 libfontconfig:i386 libgl1-mesa-glx:i386 libglu1-mesa:i386 libsm-dev:i386 lsb-core:i386
	sudo apt-get install libfontconfig1:i386 libx11-6:i386 libxrender1:i386 libxext6:i386 libgl1-mesa-glx:i386 libglu1-mesa:i386 libglib2.0-0:i386 libsm6:i386
	wget -O /tmp/earth.deb http://dl.google.com/dl/earth/client/current/google-earth-stable_current_i386.deb
	sudo dpkg -i /tmp/earth.deb
	touch $@

stamps/sparkleshare:
	sudo apt-get install -y sparkleshare
	touch $@

stamps/tmux: stamps/git
	sudo apt-get install -y tmux
	mkdir -p ~/.tmux/plugins
	git clone https://github.com/tmux-plugins/tpm ~/.tmux/plugins/tpm
	ln -s ${PWD}/data/tmux.cong ${HOME}/.tmux.conf
	touch $@

.PHONY: zsh ocaml git apps google-earth opam
