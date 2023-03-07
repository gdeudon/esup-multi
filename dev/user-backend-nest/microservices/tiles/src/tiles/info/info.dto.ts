import {
  AbstractTile,
  Authorization,
  DirectusSettingsByRole,
  DirectusTileTranslation,
  TileType,
} from '../tiles.dto';

export interface Info extends AbstractTile {
  link?: string;
  ssoService?: string;
  type: TileType.Info;
}

export interface DirectusInfo {
  id: number;
  position: number | null;
  translations: DirectusTileTranslation[];
  widget: string;
  link?: string;
  ssoService?: string;
  authorization?: Authorization;
  settings_by_role: DirectusSettingsByRole[];
}
