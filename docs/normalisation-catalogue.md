# Convention commune de nommage — matériel et modèles

Version du document : **0.1 — proposition à valider**  
Date : **7 octobre 2026**  
Projets : **LLM-Benchmarker et NVNC-Tech**

## Objectif

Utiliser les mêmes noms dans les exports de LLM-Benchmarker et dans les fiches NVNC, pour relier les benchmarks sans recopier manuellement des noms différents.

Cette proposition décrit le nommage. Elle ne modifie pas encore les applications, les exports ou les bases. Les exemples indiquent une forme de nom ; ils ne constituent pas un inventaire de produits ou de configurations disponibles.

## 1. Règles simples

- Utiliser le caractère `_` pour séparer les parties.
- Ne pas utiliser d’espaces ni d’accents dans le nom normalisé.
- Garder une écriture commune : `Apple`, `Nvidia`, `MacBookPro`, `MacBookAir`, `MacMini`, `MacStudio`, `M3Pro`, `M3Max`, `RTX`, `RX`, `MLX`, `GGUF`, `NVFP4`, `Q4_K_M`.
- Conserver les points nécessaires aux versions et aux tailles décimales : `Qwen3.6`, `3.5B`.
- La casse est normalisée lors du rapprochement : `m3pro` et `M3Pro` ne créent pas deux références.
- Une donnée inconnue reste inconnue. Ne pas inventer une capacité, une taille d’écran ou une quantification.
- Un nom lisible et un identifiant technique de fiche peuvent coexister. Les identifiants et URL des fiches déjà créées ne sont pas renommés automatiquement.

Les champs du rapport servent à construire le nom. On ne déduit pas toutes les spécifications en découpant une chaîne : certains noms, comme `Q4_K_M`, contiennent eux-mêmes des underscores.

## 2. Matériel

La catégorie est enregistrée séparément du nom.

| Catégorie | Forme proposée | Exemple de nommage |
|---|---|---|
| Mono GPU | `Carte_MemoireGo` | `RTX4060_8Go`, `GTX1080_8Go`, `RX9060XT_16Go` |
| Apple portable | `MachineTaille_Puce_MemoireGo` | `MacBookPro16_M3Pro_36Go`, `MacBookAir13_M3_16Go` |
| Apple fixe | `Machine_Puce_MemoireGo` | `MacMini_M2Pro_16Go`, `MacStudio_M3Max_24Go` |
| Semi-pro | `Marque_Machine_MemoireGo` | `Nvidia_Spark_128Go` |
| Pro | `Carte_MemoireGo` | `H100_80Go`, `H200_141Go` |
| Autres / Multi-GPU | Configuration explicite | `MultiGPU_2xRTX4090_24GoChacune` |
| Cloud | `Cloud_Fournisseur` | `Cloud_Anthropic`, `Cloud_OpenAI`, `Cloud_OllamaCloud` |

### Mémoire

- Pour une carte graphique, le suffixe désigne sa **VRAM nominale**.
- Pour Apple et les machines à mémoire unifiée, il désigne la **mémoire unifiée nominale**.
- Pour un système CPU, il désigne la **RAM nominale**.
- La capacité disponible pendant le test et la consommation mesurée restent des valeurs séparées.
- Pour plusieurs GPU, indiquer la capacité par carte ; ne pas présenter leur somme comme la mémoire d’un seul GPU.
- `Go` est le suffixe lisible retenu pour le nom. Lorsque l’export fournit des octets de mémoire système, la valeur est calculée en divisant par 2^30 ; l’affichage technique reste en Gio. Les unités originales sont conservées.
- Le stockage SSD n’entre pas dans ce suffixe.

### Variantes réellement différentes

Si deux configurations ont le même nom de base, ajouter seulement la précision nécessaire :

- Apple : `MacBookPro16_M3Pro_36Go_12CPU_18GPU`.
- GPU professionnel : `H100_80Go_SXM` ou `H100_80Go_PCIE`.
- Machines différentes avec la même puce : conserver leur famille et leur taille lorsqu’elles sont connues.
- Multi-GPU mixte : `MultiGPU_RTX4090_24Go_RTX3090_24Go`.

La marque MSI, Asus, etc. reste une précision facultative ; elle ne crée pas une fiche distincte par défaut. Le nombre de cœurs, la génération ou le type de carte sont conservés dans les champs même quand ils ne figurent pas dans le nom court.

### Exemple d’un rapport Mac

Le JSON fournit M3 Pro, CPU 12 cœurs, GPU 18 cœurs et 36 Gio. Il ne fournit pas la famille précise du Mac ni sa taille d’écran.

Nom provisoire utilisable :

```text
Apple_M3Pro_36Go_12CPU_18GPU
```

Si le propriétaire confirme un MacBook Pro 16 pouces :

```text
MacBookPro16_M3Pro_36Go_12CPU_18GPU
```

L’ancien nom exporté reste un alias :

```text
Apple M3 Pro · 36 Gio (apple-silicon)
```

### Cloud

Cloud décrit le lieu d’exécution, pas le logiciel utilisé. Ollama installé sur un Mac ou un PC reste local. Ollama Cloud peut être classé Cloud.

Pour une API, conserver le fournisseur et l’identifiant du modèle appelé. Ne pas attribuer de GPU ou de mémoire au fournisseur si ces informations ne sont pas exposées. Une machine distante dont le matériel est connu peut garder sa fiche matérielle, avec le lieu d’exécution indiqué séparément.

## 3. Modèles

Deux niveaux suffisent :

| Niveau | Forme | Exemple de nommage |
|---|---|---|
| Modèle principal | `NomVersion_TailleB` | `Gemma4_12B`, `Qwen3.6_27B` |
| Version exécutée | `NomVersion_TailleB_Format_Quantification` | `Gemma4_12B_MLX_NVFP4`, `Gemma4_12B_GGUF_Q4_K_M` |

**MLX et GGUF désignent ici le format ou la variante distribuée ; NVFP4 et Q4_K_M désignent la précision ou la quantification.** Le moteur d’exécution reste un champ séparé : Ollama, llama.cpp, MLX, etc.

Quand le format n’est pas connu mais la quantification l’est :

```text
Gemma4_12B_NVFP4
```

Quand seule la variante MLX est identifiée :

```text
Gemma4_12B_MLX
```

Ce dernier nom est provisoire : il ne permet pas de confondre toutes les quantifications MLX. La précision reste marquée inconnue jusqu’à identification.

Autres exemples :

```text
Qwen3.8FlashNext_125B_MLX
Qwen3.6_27B_MLX_NVFP4
Gemma4_12B_GGUF_Q4_K_M
```

### Taille et dérivés

- `B` signifie milliards de paramètres.
- Ne pas déduire la taille uniquement du nom commercial. Vérifier la fiche ou la configuration du modèle.
- Pour MoE, utiliser les paramètres totaux dans la taille du nom ; les paramètres actifs restent séparés.
- Si la taille est inconnue, utiliser provisoirement `TailleInconnue`.
- Une quantification ou une conversion est reliée au modèle principal.
- Un fine-tune, une fusion ou une autre variante ayant un contenu différent conserve une identité distincte, même si sa taille et sa quantification sont identiques.
- Si nécessaire, ajouter un suffixe auteur/variante : `Gemma4_12B_GGUF_Q4_K_M_AuteurVariante`.
- Le dépôt source et sa révision restent conservés pour distinguer les fichiers exacts. Le nom court ne remplace pas ces informations.

L’architecture `Dense`, `MoE` ou `À vérifier` reste un champ séparé et n’est pas déduite du suffixe de quantification.

## 4. Liaison entre les deux applications

Fonctionnement proposé :

1. LLM-Benchmarker construit le nom normalisé depuis les informations disponibles et conserve le nom original.
2. L’export transporte le nom normalisé, le nom original et les informations de source.
3. NVNC cherche une fiche correspondante, en utilisant la source exacte lorsqu’elle existe, sinon un nom normalisé ou un alias unique.
4. S’il existe une correspondance unique, le benchmark est rattaché.
5. Sans correspondance, NVNC propose la création d’un brouillon prérempli.
6. S’il existe plusieurs correspondances, l’admin choisit ; aucune association arbitraire n’est faite.

Une fiche doit distinguer **modèle principal** et **version exécutée**. Les résultats d’une variante peuvent apparaître sur la fiche d’origine, mais avec son format, sa quantification et son origine visibles. Ils ne sont pas fusionnés dans une moyenne de performances entre configurations différentes.

Les notes utilisateurs restent attachées à la fiche évaluée ; un benchmark ne crée pas une note sur cinq.

## 5. Compatibilité avec ce qui existe déjà

- Les exports existants restent importables.
- Leurs anciens noms deviennent des alias lorsqu’une association unique est confirmée.
- Les identifiants des fiches, les comptes, les avis et les mesures ne sont pas réécrits automatiquement.
- Une association peut relier les benchmarks déjà importés sans les importer de nouveau.
- Les valeurs mesurées et les données originales restent conservées.

## 6. Mise en œuvre après validation

1. Valider les formes de noms et les cas inconnus de ce document.
2. Implémenter les mêmes règles et exemples de test dans les deux outils.
3. Ajouter les noms normalisés aux exports LLM-Benchmarker sans supprimer les champs actuels.
4. Ajouter dans NVNC la reconnaissance des noms, l’association assistée et les brouillons préremplis.
5. Vérifier les anciens exports, les doublons et les cas ambigus avant activation.

Le même fichier `docs/normalisation-catalogue.md`, avec le même contenu et la même version, doit être présent dans les deux dépôts. Toute évolution de la convention doit être reportée des deux côtés.

**Statut actuel : proposition documentaire. Aucun changement de fonctionnement ni aucune migration n’est activé par ce document.**
