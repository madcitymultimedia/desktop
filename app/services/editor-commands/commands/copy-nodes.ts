import { Command } from './command';
import { Selection } from 'services/selection';
import { Inject } from 'services/core';
import { ScenesService, TSceneNode } from 'services/scenes';
import compact from 'lodash/compact';
import { $t } from 'services/i18n';
import { DualOutputService } from 'services/dual-output';
import { TDisplayType, VideoSettingsService } from 'services/settings-v2';
import { EditorService } from 'services/editor';
import { SceneCollectionsService } from 'services/scene-collections';
import { SourcesService } from 'services/sources';

/**
 * The copy nodes editor command has small variations when working with:
 *  - a vanilla scene
 *  - a dual output scene
 *  - migrating a vanilla scene to a dual output scene
 * To maximize readability, the code for this is not very DRY.
 */
export class CopyNodesCommand extends Command {
  @Inject() scenesService: ScenesService;
  @Inject() dualOutputService: DualOutputService;
  @Inject() videoSettingsService: VideoSettingsService;
  @Inject() editorService: EditorService;
  @Inject() sceneCollectionsService: SceneCollectionsService;
  @Inject() sourcesService: SourcesService;

  description: string;

  /**
   * Maps original source ids to new source ids for deterministic
   * generation of of sources with consistent ids.
   */
  private sourceIdsMap: Dictionary<string>;

  /**
   * Maps original node ids to new node ids for deterministic
   * generation of of sources with consistent ids.
   */
  private nodeIdsMap: Dictionary<string> = {};

  private hasNodeMap: boolean;

  constructor(
    private selection: Selection,
    private destSceneId: string,
    private duplicateSources = false,
    private display?: TDisplayType,
  ) {
    super();
    this.selection.freeze();
    const nodes = this.selection.getNodes();
    this.description = $t('Paste %{nodeName}', { nodeName: nodes[0] ? nodes[0].name : '' });
    this.hasNodeMap = this.dualOutputService.views.hasNodeMap(this.selection.sceneId);
  }

  execute() {
    const scene = this.scenesService.views.getScene(this.destSceneId);
    const insertedNodes: TSceneNode[] = [];

    const initialNodeOrder = scene.getNodesIds();

    const isDualOutputMode = this.dualOutputService.views.dualOutputMode;

    // Duplicate necessary sources if needed
    if (this.duplicateSources) {
      this.sourceIdsMap = {};

      this.selection.getSources().forEach(source => {
        const dup = source.duplicate(this.sourceIdsMap[source.sourceId]);

        // If the source was marked as do-not-duplicate, dup will be null
        // In this case, use the original source
        this.sourceIdsMap[source.sourceId] = dup ? dup.sourceId : source.sourceId;
      });
    }

    if (isDualOutputMode && !this.hasNodeMap) {
      // if the scene does not already have a node map it is a vanilla scene
      // if it's dual output mode, copy all of the nodes and create a scene node map
      // to migrate the vanilla scene to a dual output scene

      // Create all nodes first
      this.selection.getNodes().forEach(node => {
        if (node.isFolder()) {
          // add folder
          const folder = scene.createFolder(node.name, { id: this.nodeIdsMap[node.id] });
          this.nodeIdsMap[node.id] = folder.id;

          // assign display
          const display =
            this.display ??
            this.dualOutputService.views.getNodeDisplay(node.id, this.selection.sceneId);

          folder.setDisplay(display);
          // if needed, create node map entry
          if (this.display === 'vertical') {
            // when creating dual output nodes for a vanilla scene, the passed in display is set to vertical
            // if the scene has dual output nodes, add a node map entry only when copying a horizontal node
            this.sceneCollectionsService.createNodeMapEntry(this.destSceneId, node.id, folder.id);
          }

          this.nodeIdsMap[node.id] = folder.id;
          insertedNodes.push(folder);
        } else {
          // add item
          const sourceId =
            this.sourceIdsMap != null ? this.sourceIdsMap[node.sourceId] : node.sourceId;
          const item = scene.addSource(sourceId, { id: this.nodeIdsMap[node.id] });

          // assign context and display
          const display =
            this.display ??
            this.dualOutputService.views.getNodeDisplay(node.id, this.selection.sceneId);
          const context = this.videoSettingsService.contexts[display];
          item.setSettings({ ...node.getSettings(), output: context, display });

          // if needed, create node map entry
          if (this.display === 'vertical') {
            // position all of the nodes in the upper left corner of the vertical display
            // so that all of the sources are visible
            item.setTransform({ position: { x: 0, y: 0 } });

            // when creating dual output scene nodes, the passed in display is set to vertical
            // if the scene has dual output nodes, add a node map entry only when copying a horizontal node
            this.sceneCollectionsService.createNodeMapEntry(this.destSceneId, node.id, item.id);
          }

          // add to arrays for reordering
          this.nodeIdsMap[node.id] = item.id;
          insertedNodes.push(item);
        }
      });

      this.hasNodeMap = true;
    } else {
      // otherwise, just copy all of the nodes without creating a node map
      // the node map for dual output scenes will be handled when reordering the nodes

      // in dual output mode, the user can select horizontal and vertical nodes independent of each other
      // so confirm if dual output nodes should be included
      this.selection.getNodes(isDualOutputMode).forEach(node => {
        if (node.isFolder()) {
          // add folder
          const folder = scene.createFolder(node.name, { id: this.nodeIdsMap[node.id] });

          // assign display
          const display =
            this.display ??
            this.dualOutputService.views.getNodeDisplay(node.id, this.selection.sceneId);
          folder.setDisplay(display);

          this.nodeIdsMap[node.id] = folder.id;
          insertedNodes.push(folder);
        } else {
          // add item
          const sourceId =
            this.sourceIdsMap != null ? this.sourceIdsMap[node.sourceId] : node.sourceId;
          const item = scene.addSource(sourceId, { id: this.nodeIdsMap[node.id] });

          // assign context and display
          const display =
            this.display ??
            this.dualOutputService.views.getNodeDisplay(node.id, this.selection.sceneId);
          const context = this.videoSettingsService.contexts[display];
          item.setSettings({ ...node.getSettings(), output: context, display });

          // add to arrays for reordering
          this.nodeIdsMap[node.id] = item.id;
          insertedNodes.push(item);
        }
      });
    }

    // Recreate parent/child relationships
    this.selection.getNodes().forEach(node => {
      const mappedNode = scene.getNode(this.nodeIdsMap[node.id]);
      const mappedParent = this.nodeIdsMap[node.parentId]
        ? scene.getNode(this.nodeIdsMap[node.parentId])
        : null;

      if (mappedParent) {
        mappedNode.setParent(mappedParent.id);
      }
    });

    // Recreate node order
    // Selection does not have canonical node order - scene does
    if (this.hasNodeMap) {
      // for dual output scenes, create node map while reordering nodes
      const order = compact(
        this.selection
          .getScene()
          .getNodesIds()
          .map(origNodeId => {
            if (
              this.dualOutputService.views.getNodeDisplay(origNodeId, this.selection.sceneId) ===
              'horizontal'
            ) {
              // determine if node is horizontal in original scene and get vertical node
              const origVerticalNodeId = this.dualOutputService.views.getVerticalNodeId(
                origNodeId,
                this.selection.sceneId,
              );
              const newHorizontalNodeId = this.nodeIdsMap[origNodeId];
              const newVerticalNodeId = this.nodeIdsMap[origVerticalNodeId];

              this.sceneCollectionsService.createNodeMapEntry(
                this.destSceneId,
                newHorizontalNodeId,
                newVerticalNodeId,
              );
            }
            return this.nodeIdsMap[origNodeId];
          }),
      );
      scene.setNodesOrder(order.concat(initialNodeOrder));
    } else {
      const order = compact(
        this.selection
          .getScene()
          .getNodesIds()
          .map(origNodeId => this.nodeIdsMap[origNodeId]),
      );
      scene.setNodesOrder(order.concat(initialNodeOrder));
    }

    return insertedNodes;
  }

  rollback() {
    // Rolling back this operation is as simple as removing all created items.
    // Any duplicated sources will be automatically deleted as the last scene
    // item referencing them is removed.
    const scene = this.scenesService.views.getScene(this.destSceneId);

    Object.values(this.nodeIdsMap).forEach(nodeId => {
      const node = scene.getNode(nodeId);
      if (node) node.remove();
    });

    if (this.dualOutputService.views.hasNodeMap(scene.id)) {
      this.sceneCollectionsService.removeNodeMap(scene.id);
    }
  }
}
