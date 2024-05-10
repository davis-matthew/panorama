/**
 * Zoning UI logic
 */

const TracklistSnippet = {
	TRACK: 'tracklist-track',
	SEGMENT: 'tracklist-segment',
	CHECKPOINT: 'tracklist-checkpoint'
};

class ZoneMenu {
	static panels = {
		/** @type {Panel} @static */
		zoningMenu: $.GetContextPanel(),
		/** @type {Panel} @static */
		trackList: $('#TrackList') as Panel,
		/** @type {Panel} @static */
		propertiesTrack: $('#TrackProperties') as Panel,
		/** @type {Panel} @static */
		propertiesSegment: $('#SegmentProperties') as Panel,
		/** @type {Panel} @static */
		propertiesZone: $('#ZoneProperties') as Panel,
		/** @type {DropDown} @static */
		filterSelect: $('#FilterSelect'),
		/** @type {DropDown} @static */
		volumeSelect: $('#VolumeSelect') as DropDown,
		/** @type {DropDown} @static */
		regionSelect: $('#RegionSelect') as DropDown,
		/** @type {TextEntry[][]} @static */
		regionPoints: [
			[$('#Point0X') as TextEntry, $('#Point0Y') as TextEntry],
			[$('#Point1X') as TextEntry, $('#Point1Y') as TextEntry],
			[$('#Point2X') as TextEntry, $('#Point2Y') as TextEntry],
			[$('#Point3X') as TextEntry, $('#Point3Y') as TextEntry]
		],
		/** @type {TextEntry} @static */
		regionBottom: $('#RegionBottom') as TextEntry,
		/** @type {TextEntry} @static */
		regionTop: $('#RegionTop') as TextEntry,
		/** @type {TextEntry} @static */
		regionSafeHeight: $('#RegionSafeHeight') as TextEntry,
		/** @type {DropDown} @static */
		regionTPDest: $('#RegionTPDest')
	};

	static selectedZone: TrackBase | Segment | Zone | null;
	static mapZoneData: Base | null;

	static {
		$.RegisterForUnhandledEvent('ZoneMenu_Show', this.showZoneMenu.bind(this));
		$.RegisterForUnhandledEvent('ZoneMenu_Hide', this.hideZoneMenu.bind(this));

		$.RegisterForUnhandledEvent('LevelInitPostEntity', this.initMenu.bind(this));
	}

	static initMenu() {
		//@ts-expect-error API name
		this.mapZoneData = MomentumTimerAPI.GetActiveZoneDefs() as Base; //this.generateRandomMapZones(4, [2, 1, 2, 3], 3, 1280, 960, 720);

		this.createTrackEntry(this.panels.trackList, this.mapZoneData.tracks.main);

		for (const [_, bonus] of this.mapZoneData.tracks.bonuses.entries()) {
			this.createTrackEntry(this.panels.trackList, bonus);
		}

		const mainTrack = this.mapZoneData.tracks.main;
		$.Msg(mainTrack.zones.segments.length + ' segments');
		$.Msg(mainTrack.zones.segments[0].checkpoints.length + ' checkpoints');
		//const volumeIndex = mainTrack.zones.segments[0].checkpoints[0].volumeIndex;
		const volumes = this.mapZoneData.volumes as Volume[];
		const region = volumes[0].regions[0];
		$.Msg(volumes.length + ' volumes');
		$.Msg(volumes[0].regions.length + ' regions');

		this.populateDropdown(volumes, this.panels.volumeSelect, $.Localize('#Zoning_Volume') as string);
		this.panels.volumeSelect.SetSelectedIndex($.persistentStorage.getItem('zoning.volume') ?? 0);
		this.panels.volumeSelect.SetPanelEvent('oninputsubmit', () => {
			$.persistentStorage.setItem(
				'zoning.volume',
				this.panels.volumeSelect.GetSelected()?.GetAttributeUInt32('value', 0) ?? 0
			);
			ZoneMenu.updatePropertyFields(this.panels.volumeSelect);
		});

		const selectedVolume: number = $.persistentStorage.getItem('zoning.volume') ?? 0;
		if (volumes.length > 0) {
			this.populateDropdown(
				volumes[selectedVolume].regions,
				this.panels.regionSelect,
				$.Localize('#Zoning_Region') as string
			);
		}
		this.panels.regionSelect.SetSelectedIndex($.persistentStorage.getItem('zoning.region') ?? 0);
		this.panels.regionSelect.SetPanelEvent('oninputsubmit', () => {
			$.persistentStorage.setItem(
				'zoning.region',
				this.panels.regionSelect.GetSelected()?.GetAttributeUInt32('value', 0) ?? 0
			);
			ZoneMenu.updatePropertyFields(this.panels.regionSelect);
		});

		// Move these to context menu
		/*for (let point = 0; point < 4; ++point) {
			for (let axis = 0; axis < 2; ++axis) {
				this.panels.regionPoints[point][axis].text = region.points[point][axis].toFixed(2);
				this.panels.regionPoints[point][axis].text = region.points[point][axis].toFixed(2);
			}
		}
		this.panels.regionBottom.text = region.bottom.toFixed(2);
		this.panels.regionTop.text = (region.bottom + region.height).toFixed(2);*/
		this.panels.regionSafeHeight.text = region.safeHeight.toFixed(2);
	}

	static showZoneMenu() {
		// show zone menu
		if (!this.mapZoneData) {
			this.initMenu();
		}
	}

	static hideZoneMenu() {
		// hide zone menu
		if (this.panels.trackList?.Children().length) {
			for (const child of this.panels.trackList.Children()) {
				child.RemoveAndDeleteChildren();
			}
		}

		//@ts-expect-error API name
		MomentumTimerAPI.SetActiveZoneDefs(this.mapZoneData);
		this.mapZoneData = null;
	}

	static toggleCollapse(container: Panel, expandIcon: Panel, collapseIcon: Panel) {
		const shouldExpand = container.HasClass('hide');
		container.SetHasClass('hide', !shouldExpand);
		// Show the corresponding button icon
		expandIcon.SetHasClass('hide', !shouldExpand);
		collapseIcon.SetHasClass('hide', shouldExpand);
		const parent = container.GetParent();
		if (parent && parent.HasClass('zoning__tracklist-segment')) {
			parent.SetHasClass('zoning__tracklist-segment--dark', shouldExpand);
		}
	}

	static createTrackEntry(parent: Panel, entry: TrackBase) {
		const trackContainer = this.addTracklistEntry(parent, entry.name, TracklistSnippet.TRACK, entry);
		if (trackContainer === null) return;
		if (entry.zones.segments.length === 0) {
			trackContainer.RemoveAndDeleteChildren();
			parent.FindChildTraverse('CollapseButton')?.DeleteAsync(0);
			return;
		}

		for (const [i, segment] of entry.zones.segments.entries()) {
			const majorId = `Segment ${i + 1}`;
			const majorListContainer = this.addTracklistEntry(
				trackContainer,
				majorId,
				TracklistSnippet.SEGMENT,
				segment
			);
			if (majorListContainer === null) continue;
			if (segment.checkpoints.length === 0) {
				majorListContainer.RemoveAndDeleteChildren();
				trackContainer.FindChildTraverse('CollapseButton')?.DeleteAsync(0);
				continue;
			}

			for (const [j, zone] of segment.checkpoints.entries()) {
				const minorId = `Checkpoint ${j + 1}`;
				this.addTracklistEntry(majorListContainer, minorId, TracklistSnippet.CHECKPOINT, zone);
			}
			$.Msg(majorId + ' created in ' + entry.name + 'track, ' + segment.checkpoints.length + ' checkpoints.\n');
		}
	}

	static addTracklistEntry(
		parent: Panel,
		name: string,
		snippet: string,
		zone: TrackBase | Segment | Zone | null
	): Panel | null {
		const newTracklistPanel = $.CreatePanel('Panel', parent, name);
		newTracklistPanel.LoadLayoutSnippet(snippet);

		const label = newTracklistPanel.FindChildTraverse('Name') as Label;
		label.text = name;

		const collapseButton = newTracklistPanel.FindChildTraverse('CollapseButton');
		const listContainer = newTracklistPanel.FindChildTraverse('ListContainer');
		if (collapseButton && listContainer) {
			const expandIcon = newTracklistPanel.FindChildTraverse('TracklistExpandIcon') as Panel;
			const collapseIcon = newTracklistPanel.FindChildTraverse('TracklistCollapseIcon') as Panel;
			collapseButton.SetPanelEvent('onactivate', () =>
				ZoneMenu.toggleCollapse(listContainer, expandIcon, collapseIcon)
			);

			this.toggleCollapse(listContainer, expandIcon, collapseIcon);
		}

		const selectButton = newTracklistPanel.FindChildTraverse('SelectButton') as Panel;
		if (selectButton && zone) {
			selectButton.SetPanelEvent('onactivate', () => ZoneMenu.updateSelection(zone));
		}

		return listContainer;
	}

	static addOptionToDropdown(optionType: string, parent: DropDown, index: number) {
		const labelString = optionType + ` ${index}`;
		const optionPanel = $.CreatePanel('Label', parent.AccessDropDownMenu(), labelString);
		optionPanel.SetAttributeInt('value', index);
		optionPanel.text = labelString;
		parent.AddOption(optionPanel);
	}

	static populateDropdown(array: any[], dropdown: DropDown, optionType: string) {
		dropdown.RemoveAllOptions();
		for (const [i, _] of array.entries()) {
			this.addOptionToDropdown(optionType, dropdown, i);
		}
	}

	static updateSelection(newSelection: TrackBase | Segment | Zone) {
		//this.selectedZone?.RemoveClass('zoning__tracklist--active');
		//newSelectedZone.AddClass('zoning__tracklist--active');
		this.selectedZone = newSelection;

		if (!newSelection) {
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
		} else if ('volumeIndex' in newSelection) {
			$.Msg(`Zone selected. Volume: ${newSelection.volumeIndex}, Filter: ${newSelection.filterName}`);
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'visible';
			//update zone properties
			const index = (newSelection as Zone).volumeIndex;
			this.panels.volumeSelect.SetSelectedIndex(index);
			const volume = this.mapZoneData?.volumes[index];
			this.panels.regionSelect.SetSelectedIndex(0);
			this.panels.regionSafeHeight.text = volume?.regions[0].safeHeight.toFixed(2) as string;
		} else if ('checkpoints' in newSelection) {
			$.Msg(
				`Segment selected. limitStartGroundSpeed: ${newSelection.limitStartGroundSpeed}, checkpointsRequired: ${newSelection.checkpointsRequired}, checkpointsOrdered: ${newSelection.checkpointsOrdered};`
			);
			this.panels.propertiesTrack.style.visibility = 'collapse';
			this.panels.propertiesSegment.style.visibility = 'visible';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update segment properties
		} else if ('zones' in newSelection) {
			$.Msg(`Track selected. Name: ${newSelection.name}`);
			this.panels.propertiesTrack.style.visibility = 'visible';
			this.panels.propertiesSegment.style.visibility = 'collapse';
			this.panels.propertiesZone.style.visibility = 'collapse';
			//update track properties
		}
	}

	static updatePropertyFields(updatedControl: Panel) {
		// filter
		// volume
		if (updatedControl === this.panels.volumeSelect) {
			$.Msg(
				`Updated selected zone (${this.panels.volumeSelect.GetSelected()?.GetAttributeInt('value', -1) ?? -1})`
			);
		}
		// region

		if (updatedControl === this.panels.regionSelect) {
			$.Msg(
				`Updated selected region (${
					this.panels.regionSelect.GetSelected()?.GetAttributeInt('value', -1) ?? -1
				})`
			);
		}
		// 	points
		// 	bottom
		// 	top
		// 	safe height
		// 	tp dest
	}

	static showPointsMenu() {
		const pointsMenu = UiToolkitAPI.ShowCustomLayoutContextMenu(
			'RegionPoints',
			'RegionPointsMenu',
			'tracklist-region-points'
		);
	}

	static onTextSubmitted() {
		$.Msg('Updated track name!');
		//grab this.something.textentry.text
	}

	static createNewStage() {
		$.Msg('Add new stage!');
	}

	static createNewZone() {
		// create new volume and add to MapZones opbjet
		// Note: this should use point picker (c++)
		const x1: number = Math.random(); // fix random
		const x2: number = Math.random(); // fix random
		const y1: number = Math.random(); // fix random
		const y2: number = Math.random(); // fix random
		const b = 0;
		const h = 960;
		const newRegion: Region = {
			points: [
				{ x: x1, y: y1 },
				{ x: x1, y: y2 },
				{ x: x2, y: y2 },
				{ x: x2, y: y1 }
			],
			bottom: b,
			height: h,
			teleDestPos: { x: 0.5 * (x1 + x2), y: 0.5 * (y1 + y2), z: b }, // TODO: This below are required if region is part of a volume used by stafe or major checkpoint zone
			teleDestYaw: 0, // See convo in mom red 25/09/23 02:00 GMT
			teleDestTargetName: '',
			safeHeight: 0
		};

		const lastSegmentIndex = (this.mapZoneData?.tracks.main.zones.segments.length as number) - 1;
		const lastSegment = this.mapZoneData?.tracks.main.zones.segments[lastSegmentIndex] as Segment;
		const volumeCount: number = this.mapZoneData?.volumes.length as number;
		const newVolume: Volume = { regions: [newRegion] };
		this.mapZoneData?.volumes.push(newVolume);
		lastSegment.checkpoints.push({ volumeIndex: volumeCount } as Zone);

		// add to tracklist tree
		const mainTrack: Panel = this.panels.trackList.Children()[0];
		const segmentList = mainTrack.FindChildTraverse('ListContainer');
		const segmentPanel: Panel = segmentList?.Children()[lastSegmentIndex] as Panel;
		const checkpointList: Panel = segmentPanel.FindChildTraverse('ListContainer') as Panel;
		const id = `Checkpoint ${lastSegment.checkpoints.length}`;
		this.addTracklistEntry(checkpointList, id, TracklistSnippet.CHECKPOINT, { volumeIndex: volumeCount } as Zone);
	}

	static showDeletePopup() {
		UiToolkitAPI.ShowGenericPopupTwoOptionsBgStyle(
			$.Localize('#Zoning_Delete') as string,
			$.Localize('#Zoning_Delete_Message') as string,
			'warning-popup',
			$.Localize('#Zoning_Delete') as string,
			() => {
				this.deleteLastZone();
			},
			$.Localize('#Zoning_Cancel') as string,
			() => {},
			'none'
		);
	}

	static deleteLastZone() {
		// delete checkpoint from MapZones object
		const lastSegmentIndex = (this.mapZoneData?.tracks.main.zones.segments.length as number) - 1;
		const lastSegment = this.mapZoneData?.tracks.main.zones.segments[lastSegmentIndex] as Segment;
		lastSegment.checkpoints.pop();

		// delete checkpoint from tracklist tree
		const mainTrack: Panel = this.panels.trackList.Children()[0];
		const segmentList = mainTrack.FindChildTraverse('ListContainer');
		const segmentPanel: Panel = segmentList?.Children()[lastSegmentIndex] as Panel;
		const checkpointList: Panel = segmentPanel.FindChildTraverse('ListContainer') as Panel;
		checkpointList.Children()[lastSegment.checkpoints.length]?.DeleteAsync(0);
	}

	//this is here to simulate fetching map data
	static generateRandomMapZones(
		majorCheckpoints: number,
		minorCheckpoints: number[],
		numBonuses: number,
		maxWidth: number,
		zoneWidth: number,
		height: number
	): Base {
		if (majorCheckpoints !== minorCheckpoints.length) throw new Error('Fuck you');

		const safeWidth = maxWidth - zoneWidth;
		const randomBoundedPos = () => Math.floor(Math.random() * safeWidth * 2 - safeWidth);

		const randomRegion = (isMajor = true): Region => {
			const x = randomBoundedPos();
			const y = randomBoundedPos();

			return {
				points: [
					{ x: x, y: y } as Vec2D,
					{ x: x + zoneWidth, y: y } as Vec2D,
					{ x: x + zoneWidth, y: y + zoneWidth } as Vec2D,
					{ x: x, y: y + zoneWidth } as Vec2D
				],
				bottom: 0,
				height: 960,
				teleDestPos: { x: x + zoneWidth / 2, y: y + zoneWidth / 2, z: 0 } as Vec3D,
				teleDestYaw: 0,
				safeHeight: 0
			} as Region;
		};

		const randomVolume = (isMajor?: boolean): Volume => ({
			regions: [randomRegion(isMajor)]
		});

		const randomZone = (isMajor = false): Zone => {
			volumes.push(randomVolume(isMajor));
			return { volumeIndex: volumes.length - 1 } as Zone;
		};

		const doSegment = (numCPs: number): Segment => ({
			limitStartGroundSpeed: false,
			checkpointsRequired: true,
			checkpointsOrdered: false,
			checkpoints: Array.from(Array.from({ length: numCPs }), (_, i) => randomZone(i === 0)) as Zone[]
		});

		const volumes: Volume[] = [];
		const tracks: MapTracks = {
			main: {
				name: 'Main',
				movementParams: {
					maxVelocity: 0,
					defragFlags: 0
				},
				zones: {
					segmentsOrdered: true,
					segments: Array.from(Array.from({ length: majorCheckpoints }), (_, i) =>
						doSegment(minorCheckpoints[i])
					) as Segment[],
					end: randomZone(),
					cancel: []
				},
				maxVelocity: 0,
				defragFlags: 0
			},
			bonuses: Array.from(Array.from({ length: numBonuses }), (_, i) => ({
				name: 'Bonus ' + (i > 9 ? '' : '0') + (i + 1),
				zones: {
					end: randomZone(),
					segments: [doSegment(Math.ceil(Math.random() * 4))]
				}
			})) as BonusTrack[],
			stages: []
		};

		/*for (const [i, segment] of tracks.main.zones.segments.entries()) {
			tracks.stages.push({
				name: 'Stage ' + (i > 9 ? '' : '0') + (i + 1),
				zones: {
					segmentsOrdered: true,
					segments: [
						{
							limitStartGroundSpeed: segment.limitStartGroundSpeed,
							checkpointsRequired: segment.checkpointsRequired,
							checkpointsOrdered: false,
							checkpoints: segment.checkpoints
						}
					],
					end: tracks.main.zones.segments[i + 1]?.checkpoints[0] ?? tracks.main.zones.end,
					cancel: []
				},
				syncWithMain: false
			});
		}*/

		const mapID = Math.random();

		return { mapID, tracks, volumes, formatVersion: 1, dataTimestamp: Date.now() };
	}
}
