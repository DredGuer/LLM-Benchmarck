# Ollama cloud et contextes locaux — interface 0.12.1

## Tester un modèle cloud

1. Lancez l’application Ollama et connectez-vous à votre compte. Vérifiez que le modèle cloud choisi répond depuis Ollama avant le benchmark. Un modèle/alias exposé dans `/api/tags` apparaît dans la liste LLMB.
2. Lancez `npm start` dans le dépôt, puis `python3 -m http.server 8001 --bind 127.0.0.1` dans un autre terminal. Ouvrez `http://localhost:8001/llm-benchmarker.html`.
3. En Simple, choisissez le modèle et lancez. En Pro, cochez les modèles ; la file peut alterner modèles locaux et cloud. Le backend reste nécessaire aux exports automatiques et aux outils agentiques.

Le cloud passe par votre proxy Ollama local : aucune nouvelle clé cloud n’est demandée par LLMB. Les conditions d’authentification et de disponibilité relèvent d’Ollama. Une erreur HTTP ou un flux incomplet reste visible et suit la politique d’arrêt/continuation de la file. Les prompts et messages envoyés au modèle distant quittent la machine.

## Ce qui est mesuré

- TTFT et durée totale : mesurés par le navigateur, avec trajet réseau et attente du fournisseur.
- Tokens et timings natifs : déclarés par Ollama lorsqu’ils sont présents, jamais inventés en leur absence.
- Matériel, RAM, MLX, swap, contexte réel et cache du moteur cloud : inconnus. Le matériel détecté localement est celui du client ; les outils agentiques sont exécutés localement.
- Chargement cloud : inconnu. La courte chauffe est une vérification de réponse, hors moyennes, sans déduire une présence locale.

La reconnaissance utilise `remote_host`/`remote_model` dans les métadonnées ou flux, ou les suffixes `:cloud`/`-cloud` comme indice qualifié d’inféré. Les adresses distantes ne sont pas exportées. Pour un alias sans suffixe ni déclaration API, le routage peut rester inconnu jusqu’au flux ; un protocole initial de chargement local ne peut pas être garanti approprié. L’usage du nom cloud standard ou d’un alias déclaré par Ollama est préférable.

## Deux contextes et MLX

Pour un modèle local, la campagne contrôlée décharge le runner (`keep_alive: 0`), vérifie son absence dans `/api/ps`, puis recharge avec `num_ctx` demandé. Elle vérifie le contexte réellement déclaré après la chauffe. Trois répétitions ne commencent que si cette valeur correspond. Si MLX annonce encore 8192 alors que 16384 est demandé, la chauffe est conservée, le modèle est marqué partiel et cette condition est exclue des comparaisons : le benchmark ne contourne pas la vérification. Le cycle de runner ne garantit ni cache disque/OS vide, ni restitution instantanée de toute la RAM système.

Pour un modèle cloud, Ollama gère le contexte fournisseur. L’option de campagne contrôlée donne une seule série à trois répétitions/température 0 : pas de `num_ctx`, pas de double série prétendument 8192/16384, pas de comparaison de contextes validés. Le récapitulatif, les cartes et les exports indiquent cette limite. Il n’y a pas de demande de déchargement cloud.

## Vérifications

```bash
node backend/cloud-context.test.cjs
node backend/provenance-quality-controlled.test.cjs
node backend/batch-campaign.test.cjs
node backend/agentic-integration.test.cjs
node schemas/test.cjs
```

Ces tests simulent l’inférence et les API ; le sandbox agentique et les écritures des exports sont réellement exercés dans des dossiers temporaires. La validation d’Ollama cloud, de son authentification, du contexte MLX et du rendu du navigateur doit être complétée sur une machine réelle.

Sources primaires : [Ollama cloud](https://docs.ollama.com/cloud), [Contexte](https://docs.ollama.com/context-length), [API generate / keep_alive](https://docs.ollama.com/api/generate), [API ps](https://docs.ollama.com/api/ps), [Champs de routage API Ollama v0.35.1](https://github.com/ollama/ollama/blob/v0.35.1/api/types.go).
