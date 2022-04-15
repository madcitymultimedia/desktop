import { IGoLiveSettings, StreamInfoView } from '../../../services/streaming';
import { TPlatform } from '../../../services/platforms';
import { Services } from '../../service-provider';
import cloneDeep from 'lodash/cloneDeep';
import { FormInstance } from 'antd/lib/form';
import { message } from 'antd';
import { $t } from '../../../services/i18n';
import {defineGetter, injectLoading, injectState, traverse, useModule} from 'slap';
import { useForm } from '../../shared/inputs/Form';
import { getDefined } from '../../../util/properties-type-guards';
import { isEqual } from 'lodash';

type TCommonFieldName = 'title' | 'description';

export type TModificators = { isUpdateMode?: boolean; isScheduleMode?: boolean };
export type IGoLiveSettingsState = IGoLiveSettings & TModificators & { needPrepopulate: boolean };


class GoLiveSettingsState extends StreamInfoView<IGoLiveSettingsState> {

  state: IGoLiveSettingsState = {
    // platforms: {},
    // customDestinations: [],
    // advancedMode: false,
    optimizedProfile: undefined,
    tweetText: '',
    isUpdateMode: false,
    needPrepopulate: true,
    prepopulateOptions: undefined,
    ...this.savedSettings,
  };

  get settings(): IGoLiveSettingsState {
    return this.state;
  }

  /**
   * Update top level settings
   */
  updateSettings(patch: Partial<IGoLiveSettingsState>) {
    const newSettings = { ...this.state, ...patch };
    // we should re-calculate common fields before applying new settings
    const platforms = this.getViewFromState(newSettings).applyCommonFields(newSettings.platforms);
    Object.assign(this.state, { ...newSettings, platforms });
  }
  /**
   * Update settings for a specific platforms
   */
  updatePlatform(platform: TPlatform, patch: Partial<IGoLiveSettings['platforms'][TPlatform]>) {
    const updated = {
      platforms: {
        ...this.state.platforms,
        [platform]: { ...this.state.platforms[platform], ...patch },
      },
    };
    this.updateSettings(updated);
  }

  switchPlatforms(enabledPlatforms: TPlatform[]) {
    this.linkedPlatforms.forEach(platform => {
      this.updatePlatform(platform, { enabled: enabledPlatforms.includes(platform) });
    });
  }
  /**
   * Enable/disable a custom ingest destinations
   */
  switchCustomDestination(destInd: number, enabled: boolean) {
    const customDestinations = cloneDeep(this.getView().customDestinations);
    customDestinations[destInd].enabled = enabled;
    this.updateSettings({ customDestinations });
  }
  /**
   * Switch Advanced or Simple mode
   */
  switchAdvancedMode(enabled: boolean) {
    this.updateSettings({ advancedMode: enabled });

    // reset common fields for all platforms in simple mode
    if (!enabled) this.updateCommonFields(this.getView().commonFields);
  };
  /**
   * Set a common field like title or description for all eligible platforms
   **/
  updateCommonFields(
    fields: { title: string; description: string },
    shouldChangeAllPlatforms = false,
  ) {
    Object.keys(fields).forEach((fieldName: TCommonFieldName) => {
      const view = this.getView();
      const value = fields[fieldName];
      const platforms = shouldChangeAllPlatforms
        ? view.platformsWithoutCustomFields
        : view.enabledPlatforms;
      platforms.forEach(platform => {
        if (!view.supports(fieldName, [platform])) return;
        const platformSettings = getDefined(this.state.platforms[platform]);
        platformSettings[fieldName] = value;
      });
    });
  }

  getView() {
    return this;
  }

  getViewFromState(state: IGoLiveSettingsState) {
    return new StreamInfoView(state);
  }
}


// export function createSettingsState() {
//   // state: IGoLiveSettings = {
//   //   isUpdateMode: false,
//   //   platforms: {},
//   //   customDestinations: [],
//   //   tweetText: '',
//   //   optimizedProfile: undefined,
//   //   advancedMode: false,
//   //   needPrepopulate: true,
//   //   prepopulateOptions: undefined,
//   //   form: null as FormInstance | null,
//   // }
//
//   const state: IGoLiveSettingsState = {
//     isUpdateMode: false,
//     platforms: {},
//     customDestinations: [],
//     tweetText: '',
//     optimizedProfile: undefined,
//     advancedMode: false,
//     needPrepopulate: true,
//     prepopulateOptions: undefined,
//   };
//
//   const streamInfoView = new StreamInfoView({});
//
//   const getters = {
//     get settings(): IGoLiveSettings {
//       // @ts-ignore
//       return this.state;
//     },
//   };
//
//   traverse(streamInfoView, (propName, descr) => {
//     if (descr.get) {
//       defineGetter(getters, propName, descr.get);
//       return;
//     }
//     const propValue = streamInfoView[propName];
//     if (typeof propValue !== 'function') return;
//     getters[propName] = streamInfoView[propName];
//   });
//
//   const stateConfig = {
//     state,
//     getters,
//
//
//     /**
//      * Update top level settings
//      */
//     updateSettings(patch: Partial<IGoLiveSettingsState>) {
//       const newSettings = { ...this.state, ...patch };
//       // we should re-calculate common fields before applying new settings
//       const platforms = this.getViewFromState(newSettings).applyCommonFields(newSettings.platforms);
//       Object.assign(this.state, { ...newSettings, platforms });
//     },
//     /**
//      * Update settings for a specific platforms
//      */
//     updatePlatform(platform: TPlatform, patch: Partial<IGoLiveSettings['platforms'][TPlatform]>) {
//       const updated = {
//         platforms: {
//           ...this.state.platforms,
//           [platform]: { ...this.state.platforms[platform], ...patch },
//         },
//       };
//       this.updateSettings(updated);
//     },
//     switchPlatforms(enabledPlatforms: TPlatform[]) {
//       this.state.linkedPlatforms.forEach(platform => {
//         this.state.updatePlatform(platform, { enabled: enabledPlatforms.includes(platform) });
//       });
//       this.save(this.state.settings);
//       this.prepopulate();
//     }
//     /**
//      * Enable/disable a custom ingest destinations
//      */
//     switchCustomDestination(destInd: number, enabled: boolean) {
//       const customDestinations = cloneDeep(this.getView().customDestinations);
//       customDestinations[destInd].enabled = enabled;
//       this.updateSettings({ customDestinations });
//     },
//     /**
//      * Switch Advanced or Simple mode
//      */
//     switchAdvancedMode(enabled: boolean) {
//       this.updateSettings({ advancedMode: enabled });
//
//       // reset common fields for all platforms in simple mode
//       if (!enabled) this.updateCommonFields(this.getView().commonFields);
//     },
//     /**
//      * Set a common field like title or description for all eligible platforms
//      **/
//     updateCommonFields(
//       fields: { title: string; description: string },
//       shouldChangeAllPlatforms = false,
//     ) {
//       Object.keys(fields).forEach((fieldName: TCommonFieldName) => {
//         const view = this.getView();
//         const value = fields[fieldName];
//         const platforms = shouldChangeAllPlatforms
//           ? view.platformsWithoutCustomFields
//           : view.enabledPlatforms;
//         platforms.forEach(platform => {
//           if (!view.supports(fieldName, [platform])) return;
//           const platformSettings = getDefined(this.state.platforms[platform]);
//           platformSettings[fieldName] = value;
//         });
//       });
//     },
//
//     getView() {
//       return this.getViewFromState(this.state);
//     },
//
//     getViewFromState(state: IGoLiveSettingsState) {
//       return new StreamInfoView(state);
//     },
//   };
//
//
//   return stateConfig as typeof stateConfig & StreamInfoView<IGoLiveSettingsState>;
// }

/**
 * Extend GoLiveSettingsModule from StreamInfoView
 * So all getters from StreamInfoView will be available in GoLiveSettingsModule
 */
export class GoLiveSettingsModule {
  // define initial state
  state = injectState(GoLiveSettingsState);
  loading = injectLoading();


  form: FormInstance | null = null;

  setForm(form: FormInstance) {
    this.form = form;
  }

  // initial setup
  async load() {
    // take prefill options from the windows' `queryParams`
    const windowParams = Services.WindowsService.state.child.queryParams as unknown;
    if (windowParams && !isEqual(windowParams, {})) {
      getDefined(this.state.setPrepopulateOptions)(
        windowParams as IGoLiveSettings['prepopulateOptions'],
      );
    }
    await this.prepopulate();
  }

  /**
   * Fetch settings for each platform
   */
  async prepopulate() {
    const { StreamingService } = Services;
    await StreamingService.actions.return.prepopulateInfo();
    // TODO investigate mutation order issue
    await new Promise(r => setTimeout(r, 100));

    const prepopulateOptions = this.state.prepopulateOptions;
    const view = new StreamInfoView({});
    const settings = {
      ...view.savedSettings, // copy saved stream settings
      tweetText: view.getTweetText(view.commonFields.title), // generate a default tweet text
      needPrepopulate: false,
    };
    // if stream has not been started than we allow to change settings only for a primary platform
    // so delete other platforms from the settings object
    if (this.state.isUpdateMode && !view.isMidStreamMode) {
      Object.keys(settings.platforms).forEach((platform: TPlatform) => {
        if (!this.state.isPrimaryPlatform(platform)) delete settings.platforms[platform];
      });
    }

    // prefill the form if `prepopulateOptions` provided
    if (prepopulateOptions) {
      Object.keys(prepopulateOptions).forEach(platform => {
        Object.assign(settings.platforms[platform], prepopulateOptions[platform]);
      });

      // disable non-primary platforms
      Object.keys(settings.platforms).forEach((platform: TPlatform) => {
        if (!view.isPrimaryPlatform(platform)) settings.platforms[platform]!.enabled = false;
      });
    }

    this.state.updateSettings(settings);
  }

  getSettings() {
    return this.state.settings;
  }

  //
  // updateSettings(patch: Partial<IGoLiveSettingsState>) {
  //   this.state.updateSettings(patch);
  // }

  // get settings() {
  //   return this.state.state;
  // }
  //
  // getSettings() {
  //   return this.state.state;
  // }

  // get isLoading() {
  //   const state = this.state;
  //   return state.needPrepopulate || this.state.getView().isLoading;
  // }

  // get tweetText() {
  //   return this.state.tweetText;
  // }

  // get isUpdateMode() {
  //   return this.state.isUpdateMode;
  // }

  /**
   * Save current settings so we can use it next time we open the GoLiveWindow
   */
  save(settings: IGoLiveSettingsState) {
    Services.StreamSettingsService.actions.return.setGoLiveSettings(settings);
  }

  /**
   * Switch platforms on/off and save settings
   * If platform is enabled then prepopulate its settings
   */
  switchPlatforms(enabledPlatforms: TPlatform[]) {
    this.state.linkedPlatforms.forEach(platform => {
      this.state.updatePlatform(platform, { enabled: enabledPlatforms.includes(platform) });
    });
    this.save(this.state.settings);
    this.prepopulate();
  }

  /**
   * Validate the form and show an error message
   */
  async validate() {
    try {
      await getDefined(this.form).validateFields();
      return true;
    } catch (e: unknown) {
      message.error($t('Invalid settings. Please check the form'));
      return false;
    }
  }

  /**
   * Validate the form and start streaming
   */
  async goLive() {
    if (await this.validate()) {
      Services.StreamingService.actions.goLive(this.state.settings);
    }
  }
  /**
   * Validate the form and send new settings for each eligible platform
   */
  async updateStream() {
    if (
      (await this.validate()) &&
      (await Services.StreamingService.actions.return.updateStreamSettings(this.state.settings))
    ) {
      message.success($t('Successfully updated'));
    }
  }
}

export function useGoLiveSettings() {
  return useModule(GoLiveSettingsModule);
}

export function useGoLiveSettingsRoot(params?: { isUpdateMode: boolean }) {
  const form = useForm();

  const useModuleResult = useModule(GoLiveSettingsModule, {
    isUpdateMode: params?.isUpdateMode,
  });

  useModuleResult.setForm(form);
  return useModuleResult;
}
