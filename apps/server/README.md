# the btca server

all of the actual "logic" for btca needs to live in here. it needs to be easy to stick the server in a sandbox or run it locally.

this is gonna be the most effect-ified thing I've ever built

_things for it to do_

- manage resources
- create collections
- start an opencode instance
- handle threads
- deal with the config

**lifecycle**

- start the server
- config is loaded. first looks in the current directory, then checks the global path, then if there's nothing it will use the default config
- a single opencode instance is created
- a db connection is created
- every question that comes in is handled by the opencode instance
- on shutdown, the opencode instance is stopped and the db connection is closed
