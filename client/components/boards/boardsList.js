const subManager = new SubsManager();
const { calculateIndex, enableClickOnTouch } = Utils;

Template.boardListHeaderBar.events({
  'click .js-open-archived-board'() {
    Modal.open('archivedBoards');
  },
});

Template.boardListHeaderBar.helpers({
  title() {
    return FlowRouter.getRouteName() === 'home' ? 'my-boards' : 'public';
  },
  templatesBoardId() {
    return Meteor.user() && Meteor.user().getTemplatesBoardId();
  },
  templatesBoardSlug() {
    return Meteor.user() && Meteor.user().getTemplatesBoardSlug();
  },
});

BlazeComponent.extendComponent({
  onCreated() {
    Meteor.subscribe('setting');
    let currUser = Meteor.user();
    let userLanguage;
    if(currUser && currUser.profile){
      userLanguage = currUser.profile.language
    }
    if (userLanguage) {
      TAPi18n.setLanguage(userLanguage);
      T9n.setLanguage(userLanguage);
    }
  },

  onRendered() {
    const itemsSelector = '.js-board:not(.placeholder)';

    const $boards = this.$('.js-boards');
    $boards.sortable({
      connectWith: '.js-boards',
      tolerance: 'pointer',
      appendTo: '.board-list',
      helper: 'clone',
      distance: 7,
      items: itemsSelector,
      placeholder: 'board-wrapper placeholder',
      start(evt, ui) {
        ui.helper.css('z-index', 1000);
        ui.placeholder.height(ui.helper.height());
        EscapeActions.executeUpTo('popup-close');
      },
      stop(evt, ui) {
        // To attribute the new index number, we need to get the DOM element
        // of the previous and the following card -- if any.
        const prevBoardDom = ui.item.prev('.js-board').get(0);
        const nextBoardBom = ui.item.next('.js-board').get(0);
        const sortIndex = calculateIndex(prevBoardDom, nextBoardBom, 1);

        const boardDomElement = ui.item.get(0);
        const board = Blaze.getData(boardDomElement);
        // Normally the jquery-ui sortable library moves the dragged DOM element
        // to its new position, which disrupts Blaze reactive updates mechanism
        // (especially when we move the last card of a list, or when multiple
        // users move some cards at the same time). To prevent these UX glitches
        // we ask sortable to gracefully cancel the move, and to put back the
        // DOM in its initial state. The card move is then handled reactively by
        // Blaze with the below query.
        $boards.sortable('cancel');

        board.move(sortIndex.base);
      },
    });

    // ugly touch event hotfix
    enableClickOnTouch(itemsSelector);

    // Disable drag-dropping if the current user is not a board member or is comment only
    this.autorun(() => {
      if (Utils.isMiniScreen()) {
        $boards.sortable({
          handle: '.board-handle',
        });
      }
    });
  },
  userHasTeams(){
    if(Meteor.user().teams)
    {
      return true;
    }
    else{
      return false;
    }
  },
  teamsDatas() {
    if(Meteor.user().teams)
    {
      return Meteor.user().teams;
    }
    else{
      return [];
    }
  },
  userHasOrgs(){
    if(Meteor.user().orgs)
    {
      return true;
    }
    else{
      return false;
    }
  },
  orgsDatas() {
    if(Meteor.user().orgs)
    {
      return Meteor.user().orgs;
    }
    else{
      return [];
    }
  },
  userHasOrgsOrTeams(){
    let boolUserHasOrgs;
    if(Meteor.user().orgs)
    {
      boolUserHasOrgs = true;
    }
    else{
      boolUserHasOrgs = false;
    }
    let boolUserHasTeams;
    if(Meteor.user().teams)
    {
      boolUserHasTeams = true;
    }
    else{
      boolUserHasTeams = false;
    }
    return (boolUserHasOrgs || boolUserHasTeams);
  },
  boards() {
    const query = {
      //archived: false,
      ////type: { $in: ['board','template-container'] },
      //type: 'board',
      $and: [
        { archived: false },
        { type: 'board' },
        { $or:[] }
      ]
    };
    if (FlowRouter.getRouteName() === 'home'){
      query.$and[2].$or.push({'members.userId': Meteor.userId()});

      const currUser = Users.findOne(Meteor.userId());

      // const currUser = Users.findOne(Meteor.userId(), {
      //   fields: {
      //     orgs: 1,
      //     teams: 1,
      //   },
      // });

      let orgIdsUserBelongs = currUser.teams !== 'undefined' ? currUser.orgIdsUserBelongs() : '';
      if(orgIdsUserBelongs && orgIdsUserBelongs != ''){
        let orgsIds = orgIdsUserBelongs.split(',');
        // for(let i = 0; i < orgsIds.length; i++){
        //   query.$and[2].$or.push({'orgs.orgId': orgsIds[i]});
        // }

        //query.$and[2].$or.push({'orgs': {$elemMatch : {orgId: orgsIds[0]}}});
        query.$and[2].$or.push({'orgs.orgId': {$in : orgsIds}});
      }

      let teamIdsUserBelongs = currUser.teams !== 'undefined' ? currUser.teamIdsUserBelongs() : '';
      if(teamIdsUserBelongs && teamIdsUserBelongs != ''){
        let teamsIds = teamIdsUserBelongs.split(',');
        // for(let i = 0; i < teamsIds.length; i++){
        //   query.$or[2].$or.push({'teams.teamId': teamsIds[i]});
        // }
        //query.$and[2].$or.push({'teams': { $elemMatch : {teamId: teamsIds[0]}}});
        query.$and[2].$or.push({'teams.teamId': {$in : teamsIds}});
      }
    }
    else query.permission = 'public';

    return Boards.find(query, {
      sort: { sort: 1 /* boards default sorting */ },
    });
  },
  isStarred() {
    const user = Meteor.user();
    return user && user.hasStarred(this.currentData()._id);
  },
  isAdministrable() {
    const user = Meteor.user();
    return user && user.isBoardAdmin(this.currentData()._id);
  },

  hasOvertimeCards() {
    subManager.subscribe('board', this.currentData()._id, false);
    return this.currentData().hasOvertimeCards();
  },

  hasSpentTimeCards() {
    subManager.subscribe('board', this.currentData()._id, false);
    return this.currentData().hasSpentTimeCards();
  },

  isInvited() {
    const user = Meteor.user();
    return user && user.isInvitedTo(this.currentData()._id);
  },

  events() {
    return [
      {
        'click .js-add-board': Popup.open('createBoard'),
        'click .js-star-board'(evt) {
          const boardId = this.currentData()._id;
          Meteor.user().toggleBoardStar(boardId);
          evt.preventDefault();
        },
        'click .js-clone-board'(evt) {
          Meteor.call(
            'copyBoard',
            this.currentData()._id,
            {
              sort: Boards.find({ archived: false }).count(),
              type: 'board',
              title: Boards.findOne(this.currentData()._id).title,
            },
            (err, res) => {
              if (err) {
                this.setError(err.error);
              } else {
                Session.set('fromBoard', null);
                Utils.goBoardId(res);
              }
            },
          );
          evt.preventDefault();
        },
        'click .js-archive-board'(evt) {
          const boardId = this.currentData()._id;
          Meteor.call('archiveBoard', boardId);
          evt.preventDefault();
        },
        'click .js-accept-invite'() {
          const boardId = this.currentData()._id;
          Meteor.call('acceptInvite', boardId);
        },
        'click .js-decline-invite'() {
          const boardId = this.currentData()._id;
          Meteor.call('quitBoard', boardId, (err, ret) => {
            if (!err && ret) {
              Meteor.call('acceptInvite', boardId);
              FlowRouter.go('home');
            }
          });
        },
        'click #resetBtn'(event){
          let allBoards = document.getElementsByClassName("js-board");
          let currBoard;
          for(let i=0; i < allBoards.length; i++){
            currBoard = allBoards[i];
            currBoard.style.display = "block";
          }
        },
        'click #filterBtn'(event) {
          event.preventDefault();
          let selectedTeams = document.querySelectorAll('#jsAllBoardTeams option:checked');
          let selectedTeamsValues = Array.from(selectedTeams).map(function(elt){return elt.value});
          let index = selectedTeamsValues.indexOf("-1");
          if (index > -1) {
            selectedTeamsValues.splice(index, 1);
          }

          let selectedOrgs = document.querySelectorAll('#jsAllBoardOrgs option:checked');
          let selectedOrgsValues = Array.from(selectedOrgs).map(function(elt){return elt.value});
          index = selectedOrgsValues.indexOf("-1");
          if (index > -1) {
            selectedOrgsValues.splice(index, 1);
          }

          if(selectedTeamsValues.length > 0 || selectedOrgsValues.length > 0){
            const query = {
              $and: [
                { archived: false },
                { type: 'board' },
                { $or:[] }
              ]
            };
            if(selectedTeamsValues.length > 0)
            {
              query.$and[2].$or.push({'teams.teamId': {$in : selectedTeamsValues}});
            }
            if(selectedOrgsValues.length > 0)
            {
              query.$and[2].$or.push({'orgs.orgId': {$in : selectedOrgsValues}});
            }

            let filteredBoards = Boards.find(query, {}).fetch();
            let allBoards = document.getElementsByClassName("js-board");
            let currBoard;
            if(filteredBoards.length > 0){
              let currBoardId;
              let found;
              for(let i=0; i < allBoards.length; i++){
                currBoard = allBoards[i];
                currBoardId = currBoard.classList[0];
                found = filteredBoards.find(function(board){
                  return board._id == currBoardId;
                });

                if(found !== undefined)
                  currBoard.style.display = "block";
                else
                  currBoard.style.display = "none";
              }
            }
            else{
              for(let i=0; i < allBoards.length; i++){
                currBoard = allBoards[i];
                currBoard.style.display = "none";
              }
            }
          }
        },
      },
    ];
  },
}).register('boardList');
