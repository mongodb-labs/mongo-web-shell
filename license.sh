#!/bin/bash
function applyLicense {
	f=$(basename $1)
	ext="${f##*.}"
	filesize=$(wc -c < $1 | tr -d ' ')
	dd if="$1" bs=1 count=$(wc -c < licenses/LICENSE.$ext | tr -d ' ') 2>/dev/null \
		| diff licenses/LICENSE.$ext - &>/dev/null
	if [[ $? -ne 0 ]] && [[ $filesize -gt 0 ]]; then
		echo $1
		if [[ $2 != '--check' ]]; then
			cp $1 licenses/temp$$
			cat licenses/LICENSE.$ext licenses/temp$$ > $1
			rm licenses/temp$$
		fi
	fi
}
find . -type f ! -path './frontend/lib/*' \
               ! -path './node_modules/*' \
               ! -path './venv/*' \
               ! -path './.git/*' \
               ! -path './frontend/dist/mongoWebShell.js' \
               \( -name '*.py' -o -name '*.js' \) \
	| while read file; do applyLicense "$file" $1; done
