theme: stamps/icons stamps/gtk-theme stamps/docky

.PHONY: theme

FAIENCE=/usr/share/icons/Faience
FAENZA=/usr/share/icons/Faenza
IMG_DIRS=16 22 24 32 48 64 96

stamps/icons:
	# okay I know this may sound too much, but it's the best
	# combination of icons ;)
	wget -O /tmp/faenza.zip http://faenza-icon-theme.googlecode.com/files/faenza-icon-theme_1.3.zip
	mkdir -p /tmp/faenza
	cd /tmp/faenza && unzip /tmp/faenza.zip && sudo ./INSTALL
	bash -c "sudo rm -f ${FAENZA}{,-Ambiance,-Dark,-Darker,-Darkest}/actions/{32,48,64,96,scalable}/*media*"
	bash -c "sudo rm -f ${FAENZA}{,-Ambiance,-Dark,-Darker,-Darkest}/actions/{32,48,64,96,scalable}/*log*"
	#faience
	wget -O /tmp/faience.zip http://faience-theme.googlecode.com/files/faience-icon-theme_0.5.zip
	mkdir -p /tmp/faience
	cd /tmp/faience && unzip /tmp/faience.zip && sudo ./INSTALL
	sudo cp -rf ${FAENZA}-Dark/status/* ${FAIENCE}/status/
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
	# now go ahead and change the theme to faience on gnome-tweak-tool
	gnome-tweak-tool
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

stamps/gtk-theme: stamps/cursor
	sudo add-apt-repository ppa:numix/ppa
	sudo apt-get update
	sudo apt-get install -y numix-gtk-theme numix-icon-theme numix-plymouth-theme
	# now go ahead and change the theme on gnome-tweak-tool
	gnome-tweak-tool
	touch $@
