" CTRL+O = haxe std lib
map <C-]> :CtrlP /usr/lib/haxe/std<CR>
autocmd BufEnter * call system("tmux rename-window " . expand("%:t"))
