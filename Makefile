all: stamps/init stamps/basic

include *.mk

init: stamps/init

stamps/init:
	sudo apt-get install vim
