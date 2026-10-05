# Inventaire Apple — première collecte matérielle

Le backend expose `GET /api/hardware` et inclut `hardwareInventory` dans
`GET /api/environment` sur macOS. Les autres plateformes conservent leur détection actuelle ;
`/api/hardware` retourne 501 sur celles-ci à cette étape.

## Données et sources

| Information | Source |
|---|---|
| Puce CPU exacte | system_profiler SPHardwareDataType, puis sysctl machdep.cpu.brand_string |
| Cœurs physiques/logiques | sysctl hw.physicalcpu / hw.logicalcpu |
| Cœurs performance/efficacité | sysctl hw.perflevel*.name et physicalcpu ; pas de déduction si le nom manque |
| Fréquence déclarée | hw.cpufrequency_max, puis hw.cpufrequency ; inconnue si non exposée |
| RAM physique | sysctl hw.memsize, secours os.totalmem |
| GPU et cœurs GPU | system_profiler SPDisplaysDataType, sppci_cores (secours spdisplays_cores) |
| Disques physiques | diskutil list -plist physical et diskutil info |
| Version macOS | sw_vers -productVersion, séparée de la version du noyau |

Apple Silicon est identifié à partir de la puce détectée. La RAM est un pool unifié CPU/GPU,
sans inventer une capacité VRAM supplémentaire. Les disques physiques sont séparés des
volumes APFS pour éviter de compter plusieurs fois leur capacité. Aucun rôle du disque
(modèle/offload) n'est supposé. SSD/HDD, transport et capacité sont renseignés lorsque disponibles.

Le transport « Apple Fabric » est conservé comme `apple-fabric`, sans le déduire comme NVMe.

La fréquence CPU déclarée n'est pas une mesure en direct. Aucun débit SSD n'est mesuré :
aucune lecture/écriture de benchmark, aucun test destructif, aucun accès aux fichiers modèles.
La vitesse négociée du bus et la bande passante mémoire ne sont pas encore collectées.

Les commandes utilisent des arguments fixes, ont un délai maximal de 5 secondes et une
sortie limitée. La collecte est mise en cache une minute, avec partage d'une collecte en cours.
Les échecs partiels sont indiqués ; les valeurs non disponibles ne sont pas remplacées par zéro.
Les numéros de série, UUID, noms de volumes, chemins et sorties système brutes ne sont pas retournés.

L'interface conserve les réglages manuels comme affichage déclaré, et présente l'inventaire
observé séparément. L'export Markdown ajoute cet inventaire avec sources ; le JSON v1 conserve
l'inventaire dans environment.hardwareInventory. Il ne s'agit pas encore d'un export v2 complet.

## Tester

```bash
node backend/apple-inventory.test.cjs
node schemas/test.cjs
```

Les tests utilisent des sorties macOS simulées et vérifient aussi la compatibilité de la
machine collectée avec le schéma v2. Le test sur un vrai Mac reste nécessaire.

Après mise à jour : redémarrer le backend, recharger l'interface et examiner
`http://localhost:3001/api/hardware`. Comparer CPU/cœurs/RAM/SSD au Rapport système de macOS.
