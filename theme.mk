wm: YOU_MUST_SET_THIS_VARIABLE_TO_gnome_OR_unity

theme: stamps/icons stamps/gtk-theme stamps/docky stamps/terminal-theme stamps/${wm}-extensions stamps/variety stamps/fonts

.PHONY: theme wm

stamps/gnome-init:
	sudo apt-get install -y gnome-tweak-tool
	touch $@

stamps/unity-init:
	sudo apt-get install -y unity-tweak-tool
	touch $@

FAIENCE=/usr/share/icons/Faience
FAENZA=/usr/share/icons/Faenza
IMG_DIRS=16 22 24 32 48 64 96

stamps/icons: stamps/${wm}-init
	# okay I know this may sound too much, but it's the best
	# combination of icons ;)
	wget -O /tmp/faenza.zip http://faenza-icon-theme.googlecode.com/files/faenza-icon-theme_1.3.zip
	mkdir -p /tmp/faenza
	cd /tmp/faenza && unzip /tmp/faenza.zip && sudo ./INSTALL
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAENZA}-Darkest/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAENZA}-Darker/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAENZA}-Dark/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAENZA}-Darkest/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAENZA}-Darker/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAENZA}-Dark/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAENZA}-Darkest/apps/16/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAENZA}-Darker/apps/16/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAENZA}-Dark/apps/16/
	bash -c "sudo rm -f ${FAENZA}{,-Ambiance,-Dark,-Darker,-Darkest}/actions/{32,48,64,96,scalable}/*media*"
	bash -c "sudo rm -f ${FAENZA}{,-Ambiance,-Dark,-Darker,-Darkest}/actions/{32,48,64,96,scalable}/*log*"
	#faience
	wget -O /tmp/faience.zip http://faience-theme.googlecode.com/files/faience-icon-theme_0.5.zip
	mkdir -p /tmp/faience
	cd /tmp/faience && unzip /tmp/faience.zip && sudo ./INSTALL
	sudo cp -rf ${FAENZA}-Dark/status/* ${FAIENCE}/status/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAIENCE}/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAIENCE}-Azur/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/24/* ${FAIENCE}/apps/24/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAIENCE}-Ocre/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAIENCE}-Azur/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/22/* ${FAIENCE}-Ocre/apps/22/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAIENCE}/apps/16/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAIENCE}-Azur/apps/16/
	- sudo cp -f /usr/share/icons/ubuntu-mono-dark/apps/16/* ${FAIENCE}-Ocre/apps/16/
	bash -c "sudo rm -rf ${FAIENCE}/actions/{32,48,64,96,scalable}"
	sudo cp -rf ${FAENZA}-Dark/actions/32 ${FAIENCE}/actions
	sudo cp -rf ${FAENZA}-Dark/actions/48 ${FAIENCE}/actions
	sudo cp -rf ${FAENZA}-Dark/actions/64 ${FAIENCE}/actions
	sudo cp -rf ${FAENZA}-Dark/actions/96 ${FAIENCE}/actions
	sudo cp -rf ${FAENZA}-Dark/actions/scalable ${FAIENCE}/actions
	# numix icons
	git clone https://github.com/numixproject/numix-icon-theme.git /tmp/numix-icons
	sudo cp -n /tmp/numix-icons/Numix/scalable/actions/* ${FAENZA}/actions/scalable
	sudo cp -n /tmp/numix-icons/Numix/32*/actions/* ${FAENZA}/actions/32
	sudo cp -n /tmp/numix-icons/Numix/48*/actions/* ${FAENZA}/actions/48
	sudo cp -n /tmp/numix-icons/Numix/64*/actions/* ${FAENZA}/actions/64
	sudo cp -n /tmp/numix-icons/Numix/scalable/actions/* ${FAIENCE}/actions/scalable
	sudo cp -n /tmp/numix-icons/Numix/32*/actions/* ${FAIENCE}/actions/32
	sudo cp -n /tmp/numix-icons/Numix/48*/actions/* ${FAIENCE}/actions/48
	sudo cp -n /tmp/numix-icons/Numix/64*/actions/* ${FAIENCE}/actions/64
	$(foreach dir,${IMG_DIRS},sudo cp -f ${FAENZA}/apps/$(dir)/firefox-original.png ${FAIENCE}/apps/$(dir)/firefox.png; )
	$(foreach dir,${IMG_DIRS},sudo cp -f ${FAENZA}/apps/$(dir)/keepassx.png ${FAIENCE}/apps/$(dir)/keepass2.png; )
	sudo cp ${FAENZA}/apps/scalable/firefox-original.svg ${FAIENCE}/apps/scalable/firefox.svg
	sudo cp ${FAENZA}/apps/scalable/keepassx.svg ${FAIENCE}/apps/scalable/keepass2.svg
	# now go ahead and change the theme to faience on ${wm}-tweak-tool
	${wm}-tweak-tool
	touch $@

stamps/cursor:
	sudo apt-get install -y dmz-cursor-theme
	touch $@

stamps/docky:
	sudo apt-get install -y docky	
	mkdir -p ${HOME}/.local/share/docky/themes
	ln -s ${PWD}/data/themes/docky/* ${HOME}/.local/share/docky/themes
	killall docky && docky &
	touch $@

stamps/gtk-theme: stamps/cursor stamps/${wm}-init
	sudo add-apt-repository ppa:numix/ppa
	sudo apt-get update
	sudo apt-get install -y numix-gtk-theme numix-icon-theme
	# now go ahead and change the theme on ${wm}-tweak-tool
	${wm}-tweak-tool
	touch $@

stamps/terminal-theme:
	# install the `alt` theme
	cd modules/gnome-terminal-colors && ./install.sh
	touch $@

stamps/gnome-extensions:
	# back up old 
	- mv ${HOME}/.local/share/gnome-shell/extensions ${HOME}/.local/share/gnome-shell/extensions.bkp
	ln -s ${PWD}/data/gnome-extensions ${HOME}/.local/share/gnome-shell/extensions
	touch $@

stamps/unity-extensions:
	sudo apt-get install -y compizconfig-settings-manager compiz-plugins-extra
	@echo "now we'll open ccsm"
	@echo "you should:"
	@echo "go to ubuntu unity plugin -> launcher"
	@echo "hide launcher: autohide, launcher capture mouse false, reveal edge: .2, reveal pressure: 999, edge overcome pressure 1, mouse pressure decay 1, edge stop 1, menu fade in and rest 0"
	@echo "check opacity, brightness and set opacity on gvim/terminal"
	@echo "goto move window and change to ctrl+alt"
	@echo "goto general options, set desktop size"
	@echo "goto desktop wall, change bindings"
	@echo "goto move window, change initiate move"
	ccsm
	touch $@

stamps/fonts:
	- mv ${HOME}/.fonts ${HOME}/.fonts.bkp
	ln -s ${PWD}/data/themes/fonts ${HOME}/.fonts
	touch $@

stamps/variety:
	sudo add-apt-repository ppa:variety/next
	sudo apt-get update
	sudo apt-get install variety
	mkdir -p ${HOME}/.config/variety
	/bin/bash -c "rm -rf ${HOME}/.config/variety/{pluginconfig,*.conf}"
	ln -s ${PWD}/data/themes/variety/* ${HOME}/.config/variety
	touch $@

stamps/atom-launcher:
	git clone https://github.com/ozonos/atom-launcher.git /tmp/atom
	cd /tmp/atom && sudo make install
