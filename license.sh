#!/bin/bash

# applyLicense(path, check?)
# Applies/checks for licenses in the current file
function applyLicense {
	# Pull filename and extension from arg
	f=$(basename $1)
	ext="${f##*.}"

	# If a license file for the extension exists
	if [[ -e licenses/LICENSE.$ext ]]; then
		# Get the size of the license file and compare the file to the first
		# size bytes of the source
		filesize=$(wc -c < $1 | tr -d ' ')
		dd if="$1" bs=1 count=$(wc -c < licenses/LICENSE.$ext | tr -d ' ') 2>/dev/null \
			| diff licenses/LICENSE.$ext - &>/dev/null

		# If they do not match and the file is not empty, output name of file
		if [[ $? -ne 0 ]] && [[ $filesize -gt 0 ]]; then
			echo $1

			# If not run with --check flag, then prepend license to file
			if [[ $2 != '--check' ]]; then
				cp $1 licenses/temp$$
				cat licenses/LICENSE.$ext licenses/temp$$ > $1
				rm licenses/temp$$
			fi
		fi
	fi
}

# Trap signals and remove temp file on interrupt
trap "rm -f licenses/temp$$" SIGHUP SIGINT SIGPIPE SIGTERM

# List all files in the current tree with certain exclusions, execute applyLicense foreach
find . -type f ! -path './frontend/lib/*' \
               ! -path './node_modules/*' \
               ! -path './venv/*' \
               ! -path './.git/*' \
               ! -path './frontend/dist/*' \
               ! -path './.grunt/*' \
               ! -path './_SpecRunner.html' \
	| while read file; do applyLicense "$file" $1; done
