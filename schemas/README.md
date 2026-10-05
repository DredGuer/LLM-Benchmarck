# Export communautaire v2 — contrat et collecte actuelle

Statut : **export v2 actif pour les tests de génération et le scénario agentique fichiers v1**, dans le Markdown et via le bouton JSON v2.
L'inventaire Apple, les métadonnées modèle, le contexte Auto observé, les métriques et la télémétrie disponible
alimentent le rapport. Les champs non collectés restent inconnus ; le scénario de fichiers dispose d’un exécuteur restreint, mais aucun cluster n’est lancé.

Un seul runner/inventaire donne un objet `llm-benchmarker.community` 2.0.0.
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
symboliques et les contrôles d'accès relèvent de l’exécuteur, pas de la validation JSON. Le scénario fichiers v1 les contrôle dans son harness restreint.

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

Le scénario agentique fichiers v1 est exécuté et exporté avec le contrat actuel. Les autres tâches, placements multi-GPU réellement observés et adaptateur Exo restent prévus. Les exemples sont synthétiques. Voir [la roadmap](../innovation.md).

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

## Scénario agentique runtime

`llmb-agentic-files` / `agentic-files-1.0.0` produit des tests `agentic` après chauffe séparée. Les étapes référencent les outils fixes, avec dépendances séquentielles, statut, durée et contrôles. Les artefacts ont uniquement leurs chemins relatifs fixes, type, taille et digest SHA-256 ; contenu et arguments bruts exclus. La reprise compte un appel du même outil après rejet. L’évaluation déterministe vérifie calcul, fichier structuré et relecture, sans juger toute la qualité sémantique du texte.

Temps total = tâche entière ; TTFT non mesuré, chat non streaming. Les moyennes de génération et taux de réussite agentique restent séparés. Le runner est local ; aucun placement distribué/Exo n’est déduit. [Documentation et budgets](../backend/AGENTIC_BENCHMARK.md).

```bash
node backend/agentic-harness.test.cjs
node backend/agentic-integration.test.cjs
```

Ces tests valident des exports issus du harness exécuté avec réponses modèle simulées, en complément des fixtures synthétiques existantes.
