import { Pane, PaneBody, PaneHeader } from "../pane";
import React, { FunctionComponent, useCallback } from "react";
import { Tab, TabList, TabPanel, Tabs } from "react-tabs";
import {
  getCommonHeaderNames,
  getCommonHeaderValues,
} from "../../../../common/common-headers";

import { EmptyStatePane } from "../empty-state-pane";
import { ErrorBoundary } from "../../error-boundary";
import { GrpcMethodDropdown } from "../../dropdowns/grpc-method-dropdown/grpc-method-dropdown";
import type { GrpcRequest } from "../../../../models/grpc-request";
import { GrpcSendButton } from "../../buttons/grpc-send-button";
import { GrpcTabbedMessages } from "../../viewers/grpc-tabbed-messages";
import { KeyValueEditor } from "../../key-value-editor/key-value-editor";
import { KeydownBinder } from "../../keydown-binder";
import { OneLineEditor } from "../../codemirror/one-line-editor";
import type { Settings } from "../../../../models/settings";
import { SvgIcon } from "insomnia-components";
import { documentationLinks } from "../../../../common/documentation";
import { executeHotKey } from "../../../../common/hotkeys-listener";
import { hotKeyRefs } from "../../../../common/hotkeys";
import styled from "styled-components";
import useActionHandlers from "./use-action-handlers";
import useChangeHandlers from "./use-change-handlers";
import useExistingGrpcUrls from "./use-existing-grpc-urls";
import { useGrpc } from "../../../context/grpc";
import useProtoFileReload from "./use-proto-file-reload";
import useSelectedMethod from "./use-selected-method";

interface Props {
  forceRefreshKey: number;
  activeRequest: GrpcRequest;
  environmentId: string;
  workspaceId: string;
  settings: Settings;
}

const StyledUrlBar = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: stretch;
`;

const StyledUrlEditor = styled.div`
  flex: 3 0 4em;
  max-width: 11em;
`;

const StyledDropdown = styled.div`
  flex: 1 0 auto;
`;

export const GrpcRequestPane: FunctionComponent<Props> = ({
  activeRequest,
  environmentId,
  workspaceId,
  forceRefreshKey,
}) => {
  const [state, dispatch] = useGrpc(activeRequest._id);
  const { requestMessages, running, methods } = state;
  useProtoFileReload(state, dispatch, activeRequest);
  const selection = useSelectedMethod(state, activeRequest);
  const { method, methodType, methodTypeLabel, enableClientStream } = selection;
  const handleChange = useChangeHandlers(activeRequest, dispatch);
  const handleAction = useActionHandlers(
    activeRequest._id,
    environmentId,
    // @ts-expect-error -- TSCONVERSION methodType can be undefined
    methodType,
    dispatch
  );
  const getExistingGrpcUrls = useExistingGrpcUrls(
    workspaceId,
    activeRequest._id
  );
  // Used to refresh input fields to their default value when switching between requests.
  // This is a common pattern in this codebase.
  const uniquenessKey = `${forceRefreshKey}::${activeRequest._id}`;

  const { start } = handleAction;
  const _handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (method && !running) {
        executeHotKey(event, hotKeyRefs.REQUEST_SEND, start);
      }
    },
    [method, running, start]
  );

  return (
    <KeydownBinder onKeydown={_handleKeyDown}>
      <Pane type="request">
        <PaneHeader>
          <StyledUrlBar>
            <div className="method-grpc pad-right pad-left vertically-center">
              gRPC
            </div>
            <StyledUrlEditor title={activeRequest.url}>
              <OneLineEditor
                key={uniquenessKey}
                type="text"
                forceEditor
                defaultValue={activeRequest.url}
                placeholder="grpcb.in:9000"
                onChange={handleChange.url}
                getAutocompleteConstants={getExistingGrpcUrls}
              />
            </StyledUrlEditor>
            <StyledDropdown>
              <GrpcMethodDropdown
                disabled={running}
                methods={methods}
                selectedMethod={method}
                handleChange={handleChange.method}
                handleChangeProtoFile={handleChange.protoFile}
              />
            </StyledDropdown>

            <GrpcSendButton
              running={running}
              methodType={methodType}
              handleCancel={handleAction.cancel}
              handleStart={handleAction.start}
            />
          </StyledUrlBar>
        </PaneHeader>
        <PaneBody>
          {methodType && (
            <Tabs className="react-tabs" forceRenderTabPanel>
              <TabList>
                <Tab>
                  <button>{methodTypeLabel}</button>
                </Tab>
                <Tab>
                  <button>Headers</button>
                </Tab>
              </TabList>
              <TabPanel className="react-tabs__tab-panel">
                <GrpcTabbedMessages
                  uniquenessKey={uniquenessKey}
                  tabNamePrefix="Stream"
                  messages={requestMessages}
                  bodyText={activeRequest.body.text}
                  handleBodyChange={handleChange.body}
                  showActions={running && enableClientStream}
                  handleStream={handleAction.stream}
                  handleCommit={handleAction.commit}
                />
              </TabPanel>
              <TabPanel className="react-tabs__tab-panel">
                <div className="tall wide scrollable-container">
                  <div className="scrollable">
                    <ErrorBoundary
                      key={uniquenessKey}
                      errorClassName="font-error pad text-center"
                    >
                      <KeyValueEditor
                        sortable
                        namePlaceholder="header"
                        valuePlaceholder="value"
                        descriptionPlaceholder="description"
                        pairs={activeRequest.metadata}
                        handleGetAutocompleteNameConstants={
                          getCommonHeaderNames
                        }
                        handleGetAutocompleteValueConstants={
                          getCommonHeaderValues
                        }
                        onChange={handleChange.metadata}
                      />
                    </ErrorBoundary>
                  </div>
                </div>
              </TabPanel>
            </Tabs>
          )}
          {!methodType && (
            <EmptyStatePane
              icon={<SvgIcon icon="bug" />}
              documentationLinks={[documentationLinks.introductionToInsomnia]}
              secondaryAction="Select a body type from above to send data in the body of a request"
              title="Enter a URL and send to get a response"
            />
          )}
        </PaneBody>
      </Pane>
    </KeydownBinder>
  );
};
