search="search"
replace="replace"

for entry in `ls ./data/*; do
  sed -i'.bac' "s/${search//\//\/}/${replace//\//\/}/g" $entry
  rm "$entry.bac"
done
