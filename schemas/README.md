# Export communautaire v2 — contrat et collecte actuelle

Statut : **export v2 actif pour les tests de génération et la batterie agentique 2.0.1**, dans le Markdown et via le bouton JSON v2.
L'inventaire Apple, les métadonnées modèle, le contexte Auto observé, les métriques et la télémétrie disponible
alimentent le rapport. Les champs non collectés restent inconnus ; la batterie dispose d’un exécuteur restreint, mais aucun cluster n’est lancé.

Un seul runner/inventaire donne un objet `llm-benchmarker.community` 2.2.0 pour les nouveaux résultats ; les anciens rapports 2.0.0/2.1.0 restent acceptés.
Des résultats hétérogènes donnent un objet `llm-benchmarker.community.bundle` 1.0.0 avec `reports[]`.
Chaque élément suit le schéma v2, et l'enveloppe suit [community-bundle.schema.json](community-bundle.schema.json).
Le futur importeur doit identifier le champ `schema`, puis valider chaque rapport séparément.

Le fichier [community-v2.schema.json](community-v2.schema.json) définit un JSON Schema
Draft 2020-12. Le schéma 2.0.0 prépare la collecte progressive, en priorité sur Apple Silicon.
Il couvre aussi Windows/Linux, plusieurs CPU/GPU et plusieurs machines.

## Trois dimensions distinctes

1. `machines` : matériel installé, inventaire par nœud.
2. `execution` : runner, placements demandés et observés, distribution et liens.
3. `tests` : protocole, paramètres, mesures, ressources et réussite de la tâche.

Un GPU détecté n'est pas un GPU utilisé. Un choix demandé n'est pas un placement observé.
Un cluster exécutant un seul modèle réparti utilise `distributed-inference`.
Plusieurs ordinateurs exécutant chacun leur propre benchmark utilisent `independent-machines`.
Chaque test identifie ses propres nœuds participants.

## Données matérielles et exécution

| Bloc | Champs prévus |
|---|---|
| Système | OS, version, noyau, architecture, virtualisation, source d'inventaire |
| CPU | Liste des CPU, modèle, constructeur, sockets, cœurs physiques/logiques, performance/efficacité, NUMA, instructions, fréquence |
| RAM | Capacité physique, mémoire disponible, architecture unifiée/séparée, bande passante, capacité swap |
| GPU | Liste, identifiant local, PCI, modèle, constructeur, type, mémoire dédiée/partagée/unifiée, capacité, pool partagé, pilote, backend, unités de calcul |
| Stockage | Liste, modèle, SSD/HDD/réseau, transport, système de fichiers, capacité, espace libre, rôles modèle/offload/swap/artifacts |
| Runner | Nom/version, moteur/version, backend/version, commit, protocole API |
| Modèle | Identifiant, empreinte/algorithme, format, paramètres totaux/actifs, quantification, bits, adaptateurs, modèle de brouillon |
| Placement | Nœud, CPU/GPU/disques, couches ou fragment de tenseur, mémoire déclarée, offload, source |
| Liens | Nœuds et appareils aux extrémités, transport, RDMA, bande passante, latence |
| Paramètres | Température, seed, tokens, contexte, sampling, threads, batch, concurrence, cache KV/prompt, thinking, décodage spéculatif |

Sur Apple Silicon, RAM et mémoire GPU unifiée partagent le même pool : ne pas additionner
deux capacités qui décrivent ce même pool. Une capacité GPU indépendante inconnue reste inconnue.
Pour Exo, chaque Mac reste un nœud individuel ; les placements et liens décrivent une
exécution distribuée sans imposer une architecture maître/worker.
L'exemple Exo est fictif, sans hypothèse sur une API de télémétrie disponible :
[documentation officielle Exo](https://github.com/exo-explore/exo).

## Mesures et provenance

Chaque mesure a une valeur numérique ou `null`, une unité, un statut, une source,
une nature (`measured`, `declared`, `estimated`), une date et un périmètre.
Les identifiants de nœud/appareil et la méthode précisent l'attribution.

- `available` exige une valeur numérique ; tous les autres statuts exigent `null`.
- Une valeur zéro indique une mesure zéro, jamais une absence de données.
- Capacités et tailles en octets ; temps en ms ; fréquences en Hz ; débits en unités explicites.
- Les températures peuvent être négatives ; capacités et durées doivent être non négatives.
- Les horodatages incluent le fuseau ; les échantillons utilisent un temps relatif au test.
- Les mesures par nœud ne supposent pas des horloges parfaitement synchronisées.
- RSS, physical footprint, tas JS, mémoire GPU et taille déclarée du modèle sont distincts.
- Pic/moyenne indiquent source, nombre d'échantillons, intervalle et agrégation.
- Un débit global de cluster n'est pas la somme des débits par nœud.
- Chargement, mapping, swap et offload disque sont distingués ; les lectures seules
  ne prouvent pas une stratégie d'offload.
- Thinking/réponse restent inconnus si le runner ne fournit pas de comptage séparé.

Les métriques du test prévoient tokens d'entrée/sortie/réflexion/réponse, TTFT,
temps total/chargement/prefill/génération, débits moyens/de génération et énergie.
Les ressources prévoient RSS, empreinte physique, compression/swap, CPU/GPU,
mémoire GPU, disque, réseau, température et puissance.

## Benchmarks agentiques

Un test `agentic` ajoute obligatoirement :

- Le harness/orchestrateur et sa version, le nombre d'agents.
- Les outils disponibles, leurs versions et capacités.
- Les budgets d'étapes, d'appels d'outils et de temps.
- Les étapes ordonnées, leurs dépendances, statuts, durées, appels et retries.
- Les artifacts attendus/produits : chemins relatifs, type, taille et empreinte.
- Les vérifications avec évaluateur/version, plus la réussite globale.

Le scénario exemple répond à une question, crée un dossier, écrit un Markdown puis
vérifie le résultat. Le schéma permet aussi de déplacer un fichier. L'exécution
future utilisera un dossier de test isolé ; aucun chemin absolu ni sortie du workspace
n'est autorisé dans ce profil. Le texte « fichier créé » du modèle ne suffit pas :
la réussite doit être vérifiée par le harness.

L'agenticité mesure la combinaison **modèle + harness + outils + budgets**.
Comparer les résultats exige les mêmes versions du protocole et de l'évaluateur.
Le schéma décrit des autorisations ; il ne les applique pas. L'isolation, les liens
symboliques et les contrôles d'accès relèvent de l’exécuteur, pas de la validation JSON. La batterie agentique les contrôle dans son harness restreint.

## Partage et compatibilité

Ce profil exclut prompts/réponses bruts, arguments d'outils, logs, clés, noms de machine,
numéros de série, IP et chemins locaux absolus. Les identifiants sont propres au rapport,
sans identification publique persistante du matériel.
Un validateur structurel ne peut pas détecter un secret copié dans un champ libre :
l’exporteur utilise une liste de champs autorisés ; une prévisualisation avant envoi reste à implémenter.

Les propriétés inconnues sont refusées. Évolution incompatible : nouvelle version majeure.
L'importeur doit router explicitement v1/v2, sans conversion silencieuse. Les anciennes
données absentes restent inconnues ; aucune topologie ou mesure ne doit être inventée.
Les exemples sont tous marqués `synthetic: true` et ne sont pas des résultats réels.

## Validation et tests

```bash
node schemas/test.cjs
node schemas/validate.cjs schemas/examples/*.json
```

Le validateur sans dépendances couvre le sous-ensemble de mots-clés employé ici
et des contraintes de références/topologie/étapes. Un importeur de production devra
également employer un validateur Draft 2020-12 complet et contrôler les unités,
la cohérence des valeurs, les limites de taille et les budgets pendant l'exécution.

Exemples : Apple génération, Apple agentique, cluster Exo Apple et Linux multi-GPU.

## État de l’intégration

Le contrat, l’inventaire Apple, l’export v2, le contexte Auto et la télémétrie disponible sont intégrés. Le protocole de génération courant est **0.08** ; les anciennes sessions ne sont pas réécrites et gardent leurs inconnues. La migration persistante d’historique n’est pas une fonctionnalité livrée.

La batterie agentique 2.0.1 est exécutée et exporté avec le contrat actuel. Les autres tâches, placements multi-GPU réellement observés et adaptateur Exo restent prévus. Les exemples sont synthétiques. Voir [la roadmap](../innovation.md).

## Export runtime et télémétrie

- `model.architecture`, `expertCount`, `activeExpertsPerToken` décrivent Dense/MoE sans estimer les paramètres actifs.
- `model.contextMaxTokens` est distinct de `parameters.contextTokens`, observé sur le runner chargé.
- `parameters.contextSource` explicite cette observation ; en Auto aucun `num_ctx` n'est imposé.
- `resourceSummaries.total` porte les deltas cumulés disque/swap et la taille déclarée du modèle,
  sans les faire passer pour des pics.
- `resourceSamples` contient les lectures RSS et les séries système disponibles ; unités en octets et temps relatif en ms.
- La métrique `mlx-allocator-peak-server-unattributed` conserve la portée serveur et l'attribution non vérifiée dans `method`.
- La version d’Ollama est collectée via `/api/version` lorsqu’elle est accessible ; les versions des moteurs/backends internes et autres runners restent inconnues sans collecte. Les placements réels, paramètres actifs et tokens thinking/answer séparés restent inconnus.
- L'inventaire local est celui du client pour une API distante ; le nœud d'inférence reste `inference-unknown`.
- Les historiques anciens sont exportables sans inventer les informations qui n'ont pas été collectées.
- Les données brutes de prompts/réponses, clés API, numéros de série, logs et messages d'erreur sont exclus du JSON.
  Le rapport Markdown complet inclut toujours les prompts et réponses.

```bash
node backend/community-export.test.cjs
node schemas/test.cjs
```

## Champs du protocole 0.08

- `protocol.phase` distingue `warmup`, `measurement` et les anciens cas inconnus ; la chauffe est séparée des statistiques.
- `loadState` décrit le chargement observé. `cacheState: present-coverage-unknown` signifie que des tokens réutilisés ont été rapportés, sans connaître la couverture intégrale. `cachePolicy` indique le cache géré par le runner, sans remise à zéro forcée.
- `metrics.inputTokens`, `cachedInputTokens`, `loadTime`, `prefillTime`, `generationTime` et `generationThroughput` portent les déclarations disponibles et leurs unités. `firstAnswerTime` est distinct du TTFT.
- `parameters.thinking.observed` décrit un champ de réflexion observé, sans inventer de compte de tokens séparé ; `enabled` reste inconnu lorsqu’il n’a pas été explicitement configuré.
- `completion` décrit la raison et l’état de fin ; une limite explicite ou suspectée produit `status: partial`.
- `resourceSummaries.start`/`end` conservent les niveaux avant/après, notamment swap/compression et allocation déclarée. `mlx-allocator-held-server-unattributed` décrit l’allocation conservée rapportée par le dernier événement serveur disponible.

Ces champs sont optionnels afin de conserver la validité des anciens rapports v2. Le schéma reste 2.0.0 ; la version de protocole n’est pas sa version.

## Fichiers et futur import

Le JSON téléchargé inclut un nom de modèle assaini et une date. Plusieurs modèles ajoutent un suffixe de dénombrement ; le contenu indique les identifiants exacts. Le nom du fichier n’est pas une preuve d’identité.

Un ensemble hétérogène de runner/version/inventaire forme un bundle. Les `reportId` sont créés à l’export et peuvent différer entre deux téléchargements de la même campagne ; les ID de tests conservés sont les premiers candidats à une déduplication, complétée par des vérifications de cohérence. L’importeur communautaire et l’envoi automatique ne sont pas implémentés.

L’assistant IA utilise un contexte synthétique distinct et ne stocke pas sa conclusion dans les mesures communautaires. Les sélections statistiques filtrent l’affichage sans modifier les tests exportés.

[Architecture](../TECHNICAL_README.md) · [Contribution et maintien de la documentation](../CONTRIBUTING.md)

## Capacités agentiques runtime et extension 2.1

Les six épreuves `llmb-agentic-{scenario}` / protocole `agentic-suite-2.0.0` produisent des tests `agentic` après chauffe séparée, éventuellement dans une campagne mixte. Les rapports qui les contiennent portent `schemaVersion: 2.1.0`. Le même validateur accepte 2.0.0, sans réécrire les anciennes sessions.

Champs ajoutés : `agentic.scenario` (ID/version/titre/dimensions), `evaluation.goalCompleted`, `evaluation.criteria` (ID/dimension/libellé/résultat booléen ou null), `metrics.firstToolTime` et `metrics.modelTurns`. `taskSuccess` est la conformité complète ; les états fonctionnels peuvent être corrects malgré une erreur de format/périmètre. `null` représente un critère non sollicité et doit être exclu de son dénominateur. Les taux de capacités sont des taux de critères, pas des probabilités garanties.

Étapes, outils, budgets et artefacts restent présents. Les fichiers ont chemins relatifs fixes, taille et SHA-256, sans contenu. Ni traces/réflexions, ni arguments bruts, ni jetons ni chemins temporaires ne sont exportés. Le temps total couvre la tâche entière ; TTFT/premier outil portent sur le premier échange et la première exécution. Un total de tokens incomplet reste inconnu. Aucun placement Exo/distribué n’est déduit.

Les cartes v1 et leur contrat restent compatibles ; leurs scores ne doivent pas être regroupés avec les six nouvelles épreuves. [Guide et budgets](../backend/AGENTIC_BENCHMARK.md) · [Méthodologie](../backend/AGENTIC_METHODOLOGY.md).

```bash
node backend/agentic-harness.test.cjs
node backend/agentic-suite.test.cjs
node backend/agentic-stream.test.cjs
node backend/agentic-integration.test.cjs
```

Les tests combinent états fichiers réellement exécutés, réponses modèle simulées et fixtures synthétiques historiques. Un importeur communautaire doit préserver tâches/versions/conditions et distinguer objectif atteint de conformité.

## Extension 2.2.0 : provenance, verdicts et campagnes contrôlées

`producer.version` identifie l’application d’export ; `tests[].provenance.applicationVersion` identifie celle de la mesure. Ne pas déduire la seconde de la première pour les anciens résultats. Les exports conservent le client et la localisation configurée de l’endpoint, mais aucun moteur/backend n’est déduit d’une compatibilité API. Aucune URL d’endpoint n’est exportée.

`verdict` sépare exécution, objectif, conformité et justesse. `quality` contient uniquement statut, ID/version d’évaluateur, ID de cas et critères ; il ne contient ni réponse brute ni code. `protocol.campaignId`, `contextOrder`, `requestedContextTokens` et `contextValidation` rendent les campagnes à deux contextes identifiables. `parameters` sépare contexte demandé et observé. Un contexte non vérifié/mismatched n’est pas une mesure contrôlée comparable.

Les mesures MLX peuvent contenir collecte, horodatage réel, âge, fraîcheur, nombre d’événements et chevauchement de télémétrie. Elles restent des événements serveur non attribués au modèle. Le validateur vérifie la cohérence des critères/verdicts et des contextes, sans certifier l’authenticité de données soumises.

Pour le futur site : identifier d’abord `schema` et `schemaVersion`, valider le document, puis appliquer une politique version/protocole par mesure. Accepter ou migrer les formats connus ; refuser les formats inconnus. Un résultat ancien peut être importable mais non comparable. Ne pas refuser automatiquement tous les anciens résultats simplement parce que le producteur est ancien. Les signatures ou preuves d’exécution ne sont pas mises en place.


### Routage cloud dans les exports 0.12.1

Le schéma 2.2.0 reste compatible. `tests[].provenance.inferenceEndpoint` décrit l’endpoint configuré du client : `loopback` peut donc être un proxy Ollama cloud. Le préfixe `remote-inference:` de `provenance.attribution` distingue les nouvelles passes distantes ; la source API ou l’inférence par convention de nom y est indiquée, sans URL. `participatingNodeIds` pointe alors vers `inference-unknown` ; l’inventaire `local` appartient au client, pas au moteur. Aucune ressource RSS/swap/MLX locale ne décrit cette inférence.

Une campagne cloud à trois répétitions conserve un contexte Auto inconnu et une `cachePolicy` explicite, sans `campaignId` ni contexte local faussement validé. Les anciens résultats gardent leurs données et attribution d’origine ; ce correctif ne réinterprète pas rétroactivement leurs mesures. La version `producer.version` (0.12.1) est celle du logiciel exporteur ; `provenance.applicationVersion` reste celle de la passe.

## Import NVNC-Tech

Voir [INTEROPERABILITY.md](INTEROPERABILITY.md) : contrat partagé, versionnement distinct de l’application, bundles, confidentialité et validation croisée.


## Export catalogue normalisé optionnel (application 0.17.0)

`community-normalized.schema.json` décrit le rapport 2.3.0, `community-normalized-bundle.schema.json` le bundle 1.1.0. Ces contrats ajoutent `baseSchemaVersion`, `machines[].naming` et `tests[].model.naming`, sans remplacer les identifiants et métriques originaux. Les schémas compatibles NVNC existants ne sont pas modifiés. L’importeur NVNC actuel refuse 2.3/1.1 ; conserver l’export compatible tant qu’il n’est pas mis à jour.

```bash
node backend/catalogue-naming.test.cjs
node schemas/validate-normalized.cjs chemin-du-rapport-normalise.json
```

Les clés `matchKey` sont les noms normalisés en minuscules. Leur unicité n’est pas garantie : les sources, digests et variantes restent nécessaires au rapprochement. Voir [l’implémentation](../docs/normalisation-implementation.md).
