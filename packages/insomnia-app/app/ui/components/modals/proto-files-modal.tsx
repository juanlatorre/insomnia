import * as protoManager from "../../../network/grpc/proto-manager";

import { ProtoFile, getById } from "../../../models/proto-file";
import React, { PureComponent } from "react";
import { grpcActions, sendGrpcIpcMultiple } from "../../context/grpc";

import { AUTOBIND_CFG } from "../../../common/constants";
import { AsyncButton } from "insomnia-components";
import type { GrpcDispatch } from "../../context/grpc";
import { GrpcRequestEventEnum } from "../../../common/grpc-events";
import { Modal } from "../base/modal";
import { ModalBody } from "../base/modal-body";
import { ModalFooter } from "../base/modal-footer";
import { ModalHeader } from "../base/modal-header";
import { ProtoDirectory } from "../../../models/proto-directory";
import { ProtoFileList } from "../proto-file/proto-file-list";
import { RootState } from "../../redux/modules";
import { autoBindMethodsForReact } from "class-autobind-decorator";
import { connect } from "react-redux";
import ingestProtoDirectory from "../../../network/grpc/proto-manager/ingest-proto-directory";
import { selectActiveWorkspace } from "../../redux/selectors";
import { selectExpandedActiveProtoDirectories } from "../../redux/proto-selectors";
import { update } from "../../../models/proto-file";

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends ReduxProps {
  grpcDispatch: GrpcDispatch;
}

interface State {
  selectedProtoFileId: string;
}

interface ProtoFilesModalOptions {
  preselectProtoFileId?: string;
  onSave: (arg0: string) => Promise<void>;
}

const INITIAL_STATE: State = {
  selectedProtoFileId: "",
};

const spinner = <i className="fa fa-spin fa-refresh" />;

@autoBindMethodsForReact(AUTOBIND_CFG)
class ProtoFilesModal extends PureComponent<Props, State> {
  modal: Modal | null = null;
  onSave: ((arg0: string) => Promise<void>) | null;

  constructor(props: Props) {
    super(props);
    this.state = INITIAL_STATE;
    this.onSave = null;
  }

  _setModalRef(ref: Modal) {
    this.modal = ref;
  }

  async show(options: ProtoFilesModalOptions) {
    this.onSave = options.onSave;
    this.setState({
      selectedProtoFileId: options.preselectProtoFileId || "",
    });
    this.modal?.show();
  }

  async _handleSave(e: React.SyntheticEvent<HTMLButtonElement>) {
    e.preventDefault();
    this.hide();

    if (typeof this.onSave === "function" && this.state.selectedProtoFileId) {
      await this.onSave(this.state.selectedProtoFileId);
    }
  }

  hide() {
    this.modal?.hide();
  }

  _handleSelect(id: string) {
    this.setState({
      selectedProtoFileId: id,
    });
  }

  _handleDeleteFile(protoFile: ProtoFile) {
    return protoManager.deleteFile(protoFile, (deletedId) => {
      // if the deleted protoFile was previously selected, clear the selection
      if (this.state.selectedProtoFileId === deletedId) {
        this.setState({
          selectedProtoFileId: "",
        });
      }
    });
  }

  _handleDeleteDirectory(protoDirectory: ProtoDirectory) {
    return protoManager.deleteDirectory(protoDirectory, (deletedIds) => {
      // if previously selected protoFile has been deleted, clear the selection
      if (deletedIds.includes(this.state.selectedProtoFileId)) {
        this.setState({
          selectedProtoFileId: "",
        });
      }
    });
  }

  _handleAdd() {
    const { workspace } = this.props;

    if (!workspace) {
      return;
    }

    return protoManager.addFile(workspace._id, (createdId) => {
      this.setState({
        selectedProtoFileId: createdId,
      });
    });
  }

  _handleUpload(protoFile: ProtoFile) {
    const { grpcDispatch } = this.props;
    return protoManager.updateFile(protoFile, async (updatedId) => {
      const action = await grpcActions.invalidateMany(updatedId);
      grpcDispatch(action);
      sendGrpcIpcMultiple(
        GrpcRequestEventEnum.cancelMultiple,
        action?.requestIds
      );
    });
  }

  async _handleReloadFile() {
    const { workspace, grpcDispatch } = this.props;
    const { selectedProtoFileId } = this.state;

    if (!workspace) {
      return;
    }

    const file = await getById(selectedProtoFileId);

    if (!file) {
      return;
    }

    const { contents } = await protoManager.getContent(file.protoPath);

    const updated = await update(file, {
      name: file.name,
      protoText: contents,
      protoPath: file.protoPath,
    });

    const invalidateFile = await grpcActions.invalidateMany(updated._id);
    grpcDispatch(invalidateFile);
    sendGrpcIpcMultiple(
      GrpcRequestEventEnum.cancelMultiple,
      invalidateFile?.requestIds
    );
  }

  _handleAddDirectory() {
    const { workspace } = this.props;

    if (!workspace) {
      return;
    }

    return protoManager.addDirectory(workspace._id);
  }

  _handleRename(protoFile: ProtoFile, name: string) {
    return protoManager.renameFile(protoFile, name);
  }

  render() {
    const { protoDirectories } = this.props;
    const { selectedProtoFileId } = this.state;

    return (
      <Modal ref={this._setModalRef}>
        <ModalHeader>Select Proto File</ModalHeader>
        <ModalBody className="wide pad">
          <div className="row-spaced margin-bottom bold">
            Files
            <span>
              {protoDirectories.some((pd) => !pd.dir) && (
                <AsyncButton
                  className="margin-right-sm"
                  onClick={this._handleReloadFile}
                  loadingNode={spinner}
                >
                  <i className="fa fa-refresh margin-right-xs" />
                  Reload
                </AsyncButton>
              )}
              <AsyncButton
                className="margin-right-sm"
                onClick={this._handleAddDirectory}
                loadingNode={spinner}
              >
                Add Directory
              </AsyncButton>
              <AsyncButton onClick={this._handleAdd} loadingNode={spinner}>
                Add Proto File
              </AsyncButton>
            </span>
          </div>
          <ProtoFileList
            protoDirectories={protoDirectories}
            selectedId={selectedProtoFileId}
            handleSelect={this._handleSelect}
            handleUpdate={this._handleUpload}
            handleDelete={this._handleDeleteFile}
            handleRename={this._handleRename}
            handleDeleteDirectory={this._handleDeleteDirectory}
          />
        </ModalBody>
        <ModalFooter>
          <div>
            <button
              className="btn"
              onClick={this._handleSave}
              disabled={!selectedProtoFileId}
            >
              Save
            </button>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}

const mapStateToProps = (state: RootState) => ({
  protoDirectories: selectExpandedActiveProtoDirectories(state),
  workspace: selectActiveWorkspace(state),
});

export default connect(mapStateToProps, null, null, {
  forwardRef: true,
})(ProtoFilesModal);
