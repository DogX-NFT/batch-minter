#!/bin/bash
filename="data/208.json"
search="DogX — new forms of life on your planet. 3555 individuals are going to your planet. Don't worry, maybe we'll give you a game, or maybe new technology... It's up to you puppies."
replace="DogX — new forms of life on your planet. 3555 individuals are going to your planet. Don't worry, maybe we'll give you a game, or maybe new technology... It's up to you puppies."
dir="data"
for entry in `ls ./$data`/*;
do
  if [[ $search != "" && $replace != "" ]]; then
    sed -i'.bac' "s/${search//\//\/}/${replace//\//\/}/g" $entry
    rm "$entry.bac"
  fi
done
