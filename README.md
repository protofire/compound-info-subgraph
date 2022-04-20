# [Compound Info Subgraph](https://thegraph.com/hosted-service/subgraph/papercliplabs/compound-info)

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

###### Deploy changes

```bash
graph deploy --product hosted-service papercliplabs/compound-info --deploy-key <DEPLOY_KEY>
```

Note: the DEPLOY_KEY can be found on the graph page if logged in, otherwise ask @spennyp
