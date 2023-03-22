# [Compound Info Subgraph](https://thegraph.com/explorer/subgraph?id=AcQLRyJfoDLzTAMMdR6wVE5WCowMLVP8uGkoLvZmxmAv&view=Overview)

This is the data source for [Compound Info](https://compoundfinance.info)

###### Installing dependencies

```bash
yarn global add @graphprotocol/graph-cli
yarn
```

###### Run codegen

```bash
graph codegen
```

###### Deploy changes to hosted service

```bash
graph deploy --product hosted-service papercliplabs/compound-info --deploy-key <DEPLOY_KEY>
```

###### Deploy changes to studio (decentralized)

Deploy and publish are 2 different steps

```bash
graph deploy --studio compound-info --deploy-key <DEPLOY_KEY>
```

Note: the DEPLOY_KEY can be found on the graph page if logged in, otherwise ask @spennyp
