import { _decorator, Component, Node, Prefab, instantiate, UITransform, Vec3, ScrollView, Button, Label, Color } from 'cc';
import { PropNameMap } from '../Defines';
import { ITrackData, lifeMgr } from '../Life';
import { ITalentInfo } from '../Talent';
import { eventMsg } from '../Utils/EventMessage';
import { LifeTrackItem } from './LifeTrackItem';
import { PropItem } from './PropItem';
import { UIPanel } from './UIPanel';
const { ccclass, property } = _decorator;

const showPropKeys = [
    'CHR',
    'INT',
    'STR',
    'MNY',
    'SPR'
];

const autoPlayColor = new Color(53, 194, 115);
 
@ccclass('LifeTrackPanel')
export class LifeTrackPanel extends UIPanel {
    @property(ScrollView)
    public scrollView: ScrollView  = null!;
    @property({type: Node})
    public lifeTrackGroup: Node;
    @property({type: Prefab})
    public lifeTrackItemPrfb: Prefab;

    @property({type: Node})
    public propGroup: Node;
    @property({type: Prefab})
    public propItemPrfb: Prefab;

    @property({type: Node})
    public nextYearButtonNode: Node;
    @property({type: Node})
    public autoPlayButtonNode: Node;
    @property({type: Node})
    public restartButtonNode: Node;
    @property({type: Button})
    public changeSpeedButton: Button;


    private _autoPlayButtonLbl: Label;
    private _autoPlayButton: Button;
    private _changeSpeedButtonLbl: Label;

    private _isEnd = false;
    private _isAutoPlay = false;
    private _triggerTime = 1000; // 1s
    private _timeScale = 1;
    private _timeScaleArray = [1, 2, 4, 8, 20];
    private _curTimeScaleIndex = 0;
    private _contentUITrans!: UITransform;
    private _spacing = 5;
    private _curMaxHeight = 0;
    private _propItemsMap: Map<string, PropItem> = new Map<string, PropItem>();

    get realTriggerTime() {
        return this._triggerTime / this._timeScale;
    }

    onLoad () {
        // this._contentUITrans = this.lifeTrackGroup._uiProps.uiTransformComp;
    }

    public start() {

    }

    initPanel() {
        this._contentUITrans = this.lifeTrackGroup._uiProps.uiTransformComp;
        this._autoPlayButtonLbl = this.autoPlayButtonNode.getComponentInChildren(Label);
        this._autoPlayButton = this.autoPlayButtonNode.getComponent(Button);
        this._changeSpeedButtonLbl = this.changeSpeedButton.getComponentInChildren(Label);
    }

    // update (deltaTime: number) {
    //     // [4]
    // }
    /**
     * 创建生命轨迹项
     * 该函数用于创建一个新的生命轨迹项，并将其添加到生命轨迹组中。
     * 然后设置轨迹项的位置和线条长度，并更新当前最大高度和内容的UI变换高度。
     * @param age - 生命轨迹的年龄。
     * @param description - 生命轨迹的描述。
     */
    public createLifeTrack(age:string, description: string) {
        // 实例化生命轨迹项预制体
        const itemNode = instantiate(this.lifeTrackItemPrfb);
        // 将实例化的节点设置为生命轨迹组的子节点
        itemNode.setParent(this.lifeTrackGroup);
        // 获取生命轨迹项组件
        const item = itemNode.getComponent(LifeTrackItem);
        // 设置生命轨迹项的数据
        item.setData(age, description);
        // 获取生命轨迹项的高度
        const itemHeight = item.getHeight();
        // 设置生命轨迹项的位置
        itemNode.setPosition(new Vec3(0, this._curMaxHeight, 0));
        // 设置生命轨迹项的线条长度
        item.setLineLength(itemHeight + this._spacing);

        // 更新当前最大高度
        this._curMaxHeight -= itemHeight + this._spacing;
        // 更新内容的UI变换高度
        this._contentUITrans.height = -this._curMaxHeight;
    }

    public createPropItem(name: string, value: number) {
        const itemNode = instantiate(this.propItemPrfb);
        itemNode.setParent(this.propGroup);
        const item = itemNode.getComponent(PropItem);
        item.setData(name, value);
        return item;
    }

    public onReplayButtonClicked() {
        eventMsg.emit('Replay');
    }

    public initProp() {
        this.propGroup.removeAllChildren();
        this._propItemsMap.clear();
        const property = lifeMgr.getLastRecord();
        showPropKeys.forEach((key) => {
            this._propItemsMap.set(key, this.createPropItem(PropNameMap[key], property[key]));
        })
    }

    updatePropData() {
        const property = lifeMgr.getLastRecord();
        showPropKeys.forEach((key) => {
            const item = this._propItemsMap.get(key);
            item?.updateValue(property[key]);
        })
    }

    protected onShow(selectedTalentList: ITalentInfo[], propData) {
        this._isEnd = false;
        this._isAutoPlay = true;
        this._curMaxHeight = 0;

        // bug:start不执行，先放这里
        this.initPanel();
        this.nextYearButtonNode.active = true;
        this.autoPlayButtonNode.active = true;
        this.restartButtonNode.active = false;
        this.setAutoPlayButtonState(false);

        this.lifeTrackGroup.removeAllChildren();
        const initData: any = {};
        Object.assign(initData, propData);
        const selectedTalentIds = selectedTalentList.map((talentInfo)=>talentInfo.id);
        initData.TLT = selectedTalentIds;

        const contents = lifeMgr.restart(initData);
        this.initProp();


        this.triggerOneLifeTrack();
    }


    public onNextYearButtonClicked() {
        this.triggerOneLifeTrack();
    }

    public onAutoPlayButtonClicked() {
        if (this._isAutoPlay) {
            this._isAutoPlay = false;     
        } else {
            this._isAutoPlay = true;
            this.triggerOneLifeTrack();
        }

        this.setAutoPlayButtonState(this._isAutoPlay);
    }

    setAutoPlayButtonState(isPlaying: boolean) {
        if (isPlaying) {
            this._autoPlayButton.normalColor = autoPlayColor;
            this.changeSpeedButton.node.active = true;
            this._changeSpeedButtonLbl.string = `X${this._timeScale}`;
        } else {
            this._autoPlayButton.normalColor = Color.WHITE;
            this.changeSpeedButton.node.active = false;
        }
    }

    public triggerOneLifeTrack() {
        if (!this._isEnd) {
            let track = lifeMgr.next();
            this.showOneTrackItem(track);
            this.updatePropData();
            this.scrollView.scrollToBottom(0.5);
            this._isEnd = track.isEnd;
            if (this._isEnd) {
                this.onLifeEnd();
            } else {
                if (this._isAutoPlay) {
                    setTimeout(()=> {
                        this.triggerOneLifeTrack();
                    },this.realTriggerTime);
                }
            }
        }   
    }

    public showOneTrackItem(track: ITrackData) {
        const contentText = track.content.map(
            ({type, description, grade, name, postEvent}) => {
                switch(type) {
                    case 'TLT':
                        return `天赋【${name}】发动：${description}`;
                    case 'EVT':
                        return description + (postEvent?`\n${postEvent}`:'');
                }
            }
        ).join('\n');
        
        this.createLifeTrack(`${track.age}岁 `, contentText)
    }

    onLifeEnd() {
        this.nextYearButtonNode.active = false;
        this.autoPlayButtonNode.active = false;
        this.restartButtonNode.active = true;
    }

    public onChangeSpeedButtonClicked() {
        this._curTimeScaleIndex = ++this._curTimeScaleIndex % this._timeScaleArray.length;
        this._timeScale = this._timeScaleArray[this._curTimeScaleIndex];
        this._changeSpeedButtonLbl.string = `X${this._timeScale}`;
    }
}
