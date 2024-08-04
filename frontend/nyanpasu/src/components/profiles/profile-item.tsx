import { useLockFn, useMemoizedFn, useSetState } from "ahooks";
import clsx from "clsx";
import dayjs from "dayjs";
import { AnimatePresence, motion } from "framer-motion";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { message } from "@/utils/notification";
import parseTraffic from "@/utils/parse-traffic";
import {
  FiberManualRecord,
  FilterDrama,
  InsertDriveFile,
  Menu as MenuIcon,
  Terminal,
  Update,
} from "@mui/icons-material";
import LoadingButton from "@mui/lab/LoadingButton";
import {
  alpha,
  Button,
  Chip,
  LinearProgress,
  Menu,
  MenuItem,
  Paper,
  Tooltip,
  useTheme,
} from "@mui/material";
import { Profile, useClash } from "@nyanpasu/interface";
import { cleanDeepClickEvent, cn } from "@nyanpasu/ui";
import { ProfileDialog } from "./profile-dialog";

export interface ProfileItemProps {
  item: Profile.Item;
  selected?: boolean;
  onClickChains: (item: Profile.Item) => void;
  chainsSelected?: boolean;
}

export const ProfileItem = memo(function ProfileItem({
  item,
  selected,
  onClickChains,
  chainsSelected,
}: ProfileItemProps) {
  const { t } = useTranslation();

  const { palette } = useTheme();

  const {
    setProfilesConfig,
    deleteConnections,
    updateProfile,
    deleteProfile,
    viewProfile,
  } = useClash();

  const [loading, setLoading] = useSetState({
    update: false,
    card: false,
  });

  const calc = () => {
    let progress = 0;
    let total = 0;
    let used = 0;

    if (item.extra) {
      const { download, upload, total: t } = item.extra;

      total = t;

      used = download + upload;

      progress = (used / total) * 100;
    }

    return { progress, total, used };
  };

  const { progress, total, used } = calc();

  const isRemote = item.type === "remote";

  const IconComponent = isRemote ? FilterDrama : InsertDriveFile;

  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const menuMapping = {
    Select: () => handleSelect(),
    "Edit Info": () => setOpen(true),
    "Proxy Chains": () => onClickChains(item),
    "Open File": () => viewProfile(item.uid),
    Update: () => handleUpdate(),
    "Update(Proxy)": () => handleUpdate(true),
    Delete: () => handleDelete(),
  };

  const handleSelect = useLockFn(async () => {
    if (selected) {
      return;
    }

    try {
      setLoading({ card: true });

      await setProfilesConfig({ current: item.uid });

      await deleteConnections();
    } catch (err) {
      const is_fetch_error = err instanceof Error && err.name === "FetchError";
      message(
        is_fetch_error
          ? t("FetchError", {
              content: t("Subscription"),
            })
          : `Error setting profile: \n ${err instanceof Error ? err.message : String(err)}`,
        {
          title: t("Error"),
          type: "error",
        },
      );
    } finally {
      setLoading({ card: false });
    }
  });

  const handleUpdate = useLockFn(async (proxy?: boolean) => {
    const options: Profile.Option = item.option || {
      with_proxy: false,
      self_proxy: false,
    };

    if (proxy) {
      if (item.option?.self_proxy) {
        options.with_proxy = false;
        options.self_proxy = true;
      } else {
        options.with_proxy = true;
        options.self_proxy = false;
      }
    }

    try {
      setLoading({ update: true });

      await updateProfile(item.uid, options);
    } finally {
      setLoading({ update: false });
    }
  });

  const handleDelete = useLockFn(async () => {
    try {
      await deleteProfile(item.uid);
    } catch (err) {
      message(`Delete failed: \n ${JSON.stringify(err)}`, {
        title: t("Error"),
        type: "error",
      });
    }
  });

  const MenuComp = () => {
    const handleClick = (func: () => void) => {
      setAnchorEl(null);
      func();
    };

    return (
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {Object.entries(menuMapping).map(([key, func], index) => {
          return (
            <MenuItem
              key={index}
              onClick={(e) => {
                cleanDeepClickEvent(e);
                handleClick(func);
              }}
            >
              {t(key)}
            </MenuItem>
          );
        })}
      </Menu>
    );
  };

  const [open, setOpen] = useState(false);

  return (
    <>
      <Paper
        className="relative transition-all"
        sx={{
          borderRadius: 6,
          backgroundColor: selected
            ? alpha(palette.primary.main, 0.2)
            : undefined,
        }}
      >
        <div
          className="flex cursor-pointer flex-col gap-4 p-5"
          onClick={handleSelect}
        >
          <div className="flex items-center justify-between gap-2">
            <Tooltip title={item.url}>
              <Chip
                className="!pl-2 !pr-2 font-bold"
                avatar={<IconComponent className="!size-5" color="primary" />}
                label={isRemote ? "Remote" : "Local"}
              />
            </Tooltip>

            {selected && (
              <FiberManualRecord
                className="top-0 mr-auto !size-3 animate-bounce"
                sx={{ fill: palette.success.main }}
              />
            )}

            <TextCarousel
              nodes={[
                !!item.updated && (
                  <TimeSpan ts={item.updated!} k="Subscription Updated At" />
                ),
                !!item.extra?.expire && (
                  <TimeSpan
                    ts={item.extra!.expire!}
                    k="Subscription Expires In"
                  />
                ),
              ]}
            ></TextCarousel>
          </div>

          <div>
            <p className="truncate text-lg font-bold">{item.name}</p>
            <p className="truncate">{item.desc}</p>
          </div>

          <div
            className={clsx(
              "flex items-center justify-between gap-4",
              !isRemote && "invisible",
            )}
          >
            <div className="w-full">
              <LinearProgress variant="determinate" value={progress} />
            </div>

            <Tooltip title={`${parseTraffic(used)} / ${parseTraffic(total)}`}>
              <div className="text-sm font-bold">
                {((used / total) * 100).toFixed(2)}%
              </div>
            </Tooltip>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              className="!mr-auto"
              size="small"
              variant={chainsSelected ? "contained" : "outlined"}
              startIcon={<Terminal />}
              onClick={(e) => {
                cleanDeepClickEvent(e);
                onClickChains(item);
              }}
            >
              {t("Proxy Chains")}
            </Button>

            {isRemote && (
              <Tooltip title={t("Update")}>
                <LoadingButton
                  size="small"
                  variant="outlined"
                  className="!size-8 !min-w-0"
                  onClick={(e) => {
                    cleanDeepClickEvent(e);
                    menuMapping.Update();
                  }}
                  loading={loading.update}
                >
                  <Update />
                </LoadingButton>
              </Tooltip>
            )}

            <Tooltip title={t("Menu")}>
              <Button
                size="small"
                variant="contained"
                className="!size-8 !min-w-0"
                onClick={(e) => {
                  cleanDeepClickEvent(e);
                  setAnchorEl(e.currentTarget);
                }}
              >
                <MenuIcon />
              </Button>
            </Tooltip>
          </div>
        </div>

        <motion.div
          className={cn(
            "absolute left-0 top-0 h-full w-full",
            "flex-col items-center justify-center gap-4",
            "text-shadow-xl rounded-3xl font-bold backdrop-blur",
          )}
          initial={{ opacity: 0, display: "none" }}
          animate={loading.card ? "show" : "hidden"}
          variants={{
            show: { opacity: 1, display: "flex" },
            hidden: { opacity: 0, transitionEnd: { display: "none" } },
          }}
        >
          <LinearProgress className="w-40" />

          <div>Applying Profile...</div>
        </motion.div>
      </Paper>

      <MenuComp />

      <ProfileDialog
        open={open}
        onClose={() => setOpen(false)}
        profile={item}
      />
    </>
  );
});

function TimeSpan({ ts, k }: { ts: number; k: string }) {
  const time = dayjs(ts * 1000);
  const { t } = useTranslation();
  return (
    <Tooltip title={time.format("YYYY/MM/DD HH:mm:ss")}>
      <div className="w-full text-right text-sm">
        {t(k, {
          time: time.fromNow(),
        })}
      </div>
    </Tooltip>
  );
}

function TextCarousel(props: { nodes: React.ReactNode[] }) {
  const [index, setIndex] = useState(0);
  const nodes = useMemo(
    () => props.nodes.filter((item) => !!item),
    [props.nodes],
  );

  const nextNode = useMemoizedFn(() => {
    setIndex((i) => (i + 1) % nodes.length);
  });

  useEffect(() => {
    const timer = setInterval(() => {
      nextNode();
    }, 5000);
    return () => clearInterval(timer);
  }, [index, nextNode]);
  return (
    <div className="h-6 w-24 overflow-hidden" onClick={() => nextNode()}>
      <AnimatePresence mode="wait">
        {nodes.map(
          (node, i) =>
            i == index && (
              <motion.div
                className="flex h-full w-full items-center justify-center"
                key={index}
                initial={{ y: 40, opacity: 0, scale: 0.5 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: -40, opacity: 0, scale: 0.5 }}
              >
                {node}
              </motion.div>
            ),
        )}
      </AnimatePresence>
    </div>
  );
}

export default ProfileItem;
