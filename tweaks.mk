tweaks: stamp/whitelist-systray

stamp/whitelist-systray:
	gsettings set com.canonical.Unity.Panel systray-whitelist "['all']"
	touch $@
