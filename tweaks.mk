tweaks: stamps/whitelist-systray

stamps/whitelist-systray:
	- gsettings set com.canonical.Unity.Panel systray-whitelist "['all']"
	touch $@
