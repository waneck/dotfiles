keyboard: stamps/keyboard

.PHONY:keyboard

stamps/keyboard:
	echo 'XKBOPTIONS="lv3:lwin_switch"' | sudo tee /etc/default/keyboards
	# just always answer the same
	# see http://askubuntu.com/questions/149971/how-do-you-remap-a-key-to-the-caps-lock-key-in-xubuntu
	sudo dpkg-reconfigure keyboard-configuration
	touch $@
