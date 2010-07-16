/* TranslationString class which stores information about one translation string */
function TranslationString(parent, id, source_strings, translated_strings, source_entity, context, occurrence) {

    // The StringSet holding it
    this.parent = parent;

    // The id of the default source string!
    this.id = id;

    // The context of the SE
    this.context = context;

    // The occurrence of the SE
    this.occurrence = occurrence;

    // The source strings (includes the default and the plurals)
    this.source_strings = source_strings

    // The translation (includes the default and the plurals)
    this.translated_strings = translated_strings

    // The corresponding source_entity string (we call it "Key")
    this.source_entity = source_entity;

    // holds the previous values at each given time (these values are updated on save)
    this.previous = jQuery.extend(true, {}, this.translated_strings);

    // For undo purposes!
    this.load_default = jQuery.extend(true, {}, this.translated_strings);

    // are any of the textareas modified?
    this.modified = false;

    this.toString = function() {
        return "TranslationString(" + this.id + ", '" + this.source_strings + "', '" + this.translated_strings + "');";
    }

    // Check whether textarea values are undefined or empty
    this.checkVar = function(v) {
        for(key in v){
            if(typeof v[key] === 'undefined' || !v[key]){
                return true;
            }
        }
        return false;
    }

    this.isModified = function() {
        return this.modified;
    }
    this.isUntranslated = function() {
        return this.checkVar(this.translated_strings);
    }
    this.isTranslated = function() {
        return !this.checkVar(this.translated_strings);
    }
    this.translate = function(new_string, rule) {
        if (new_string != this.translated_strings[rule]) {
            if (!this.modified){
                if (this.translated_strings[rule] == "") {
                    this.parent.untranslated_modified += 1;
                } else {
                    this.parent.translated_modified += 1;
                }
            }
            this.translated_strings[rule] = new_string;
            this.modified = true;
            this.parent.updateStats(true); // Issue statistics update with delay
        }
    }

    this.push = function() {
        this.parent.push(this);
    }

    this.flagString = function() {
        if (this.modified) {
            return "fuzzy";
        } else if (this.checkVar(this.translated_strings)) {
            return "untranslated";
        } else {
            return "translated";
        }
    }
}


/* StringSet class which stores list of translation strings and maps them to visible table */
function StringSet(json_object, push_url, from_lang, to_lang) {

    /* hold the current editing textarea object */
    this.current_box = null;

/*    The target language*/
    this.to_lang = to_lang;

/*    This array contains all the TranslationString objects of StringSet */
/*    IMPORTANT! This keeps the table row index as a key!!! */
    this.strings = []

    this_stringset = this;

/*    Timer for stats */
    this.update_stats_timer = null;

/*    Initialize strings from JSON data*/
    var i = 0;
    for(var index in json_object['aaData']) {
      var row = json_object['aaData'][index];
      this_stringset.strings[i] = new TranslationString(this, row[0], row[2]["source_strings"], row[3], row[1], null, null);
      i++;
    }
    this.filtered = this.strings;

    /* StringSet.bindToTable(target_table_id) */
    this.bindToTable = function(target_table_id) {
        this.bound_table = $("table#" + target_table_id);
    }

    // Method for pushing one or more TranslationStrings of this StringSet
    this.push = function(ts) {
        this_stringset = this;
        var to_update = [];
        if (ts) { /* Pushing one TranslationString instance */
            to_update[0] = {'id':ts.id,
                            'translations':ts.translated_strings,}; // translations includes all plurals!
        } else { /* Pushing all TranslationString instances from current StringSet */
            for (i=0; i<this.strings.length; i++)
                if (this_stringset.strings[i].modified == true) {
                    to_update.push( {'id':this.strings[i].id,
                                     'translations':this.strings[i].translated_strings,}); // translations includes all plurals!
                }
        }
        if (to_update == {}) {
            alert("No strings to push");
        } else {

            $.ajax({
                url: push_url,
                data: JSON.stringify({strings: to_update}), 
                dataType : "text", // "json" is strict and we get 500
                type: "POST",
                contentType: "application/json",
                success: function(){
                    // Update the obect classes, and the overall statistics
                    if(ts) { 
                        ts.modified = false;
                        if (ts.isUntranslated()) {
                            stringset.translated -= 1;
                            stringset.untranslated += 1;
                        } else if (ts.checkVar(ts.previous)) { 
                            stringset.translated += 1;
                            stringset.untranslated -= 1;
                        }
                        // Deep copy of the array
                        ts.previous = jQuery.extend(true, {}, ts.translated_strings);
                    } else {
                        /* For save_all button */
                        for (j=0; j<this_stringset.strings.length; j++) {
                            if (this_stringset.strings[j].modified) {
                                if ( this_stringset.strings[j].isUntranslated()) {
                                    stringset.translated -= 1;
                                    stringset.untranslated += 1;
                                } else if ( this_stringset.strings[j].checkVar(
                                    this_stringset.strings[j].previous)) {
                                    stringset.translated += 1;
                                    stringset.untranslated -= 1;
                                }
                                this_stringset.strings[j].modified = false;
                                // Deep copy of the array
                                this_stringset.strings[j].previous =  jQuery.extend(true, {}, this_stringset.strings[j].translated_strings);
                            }
                        }
                    }
                    // Update the color classes now
                    this_stringset.updateColors_Buttons();
                    stringset.translated_modified = 0;
                    stringset.untranslated_modified = 0;
                    // Update the stats too!
                    this_stringset.updateStats(true);
                },
                error: function() {
                    alert("Error saving new translation.");
                },
            });
        }
    }


    /* Update the color classes for textareas and show/hide save buttons */
    this.updateColors_Buttons = function() {
        $('tr td textarea.default_translation', this.bound_table).each(function (i) {
            var textarea = $(this);
            var id = parseInt(textarea.attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            var string = this_stringset.strings[id];
            var new_class = this_stringset.strings[id].flagString();
            
            /* Apply the new class to the default string and all its siblings! */
            textarea.siblings('textarea').removeClass("fuzzy translated untranslated").addClass(new_class);
            textarea.removeClass("fuzzy translated untranslated").addClass(new_class);

            /* Toggle per string save button */
            button_save = $("span#save_"+id);
            if (string.modified)
                button_save.show();
            else
                button_save.hide();
        });
    };

    /* Bind textarea keyup marking */
    this.bindKeyupTextArea = function() {
        $('tr td textarea.translation', this.bound_table).keyup(function() {
            var textarea = $(this);
            var id;
            if(textarea.hasClass('default_translation')){
              id = parseInt(textarea.attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            }else{
              id = parseInt(textarea.siblings('.default_translation').attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            }
            string = this_stringset.strings[id];
            string.translate(textarea.val(), textarea.prev('span.rule').text());
            if (string.modified) {
                // Automatically set edited textareas to fuzzy
                textarea.removeClass("fuzzy translated untranslated").addClass("fuzzy");
                textarea.siblings('textarea').removeClass("fuzzy translated untranslated").addClass("fuzzy");
                $('tbody tr td.notes span#save_' + id).show();
                $('tbody tr td.notes span#undo_' + id).show();
            }
        });
    }

    /* Bind save button events */
    this.bindSaveButton = function() {
        $('tr td.notes span.save', this.bound_table).click(function() {
            table_row_id = parseInt($(this).attr("id").split("_")[1]); // Get the id of current save button
            this_stringset.strings[table_row_id].push();
        });
    }

    // Bind the current textbox focus event
    // Make the focused textarea current in the StringSet!
    this.bindFocusTextArea = function() {
        $('tr td textarea.translation', this.bound_table).focus(function() {
            stringset.current_box = $(this);
        });
    }

    /* Bind undo button events */
    this.bindUndoButton = function() {
        $('tr td.notes span.undo', this.bound_table).click(function() {
            var table_row_id = parseInt($(this).attr("id").split("_")[1]); // Get the id of current undo button
            var string = this_stringset.strings[table_row_id];
            var undo_value = string.load_default;
            var tr = $(this).parents('tr');
            tr.find('span.rule').each(function(i){
                rule = $(this).text();
                string.translate(undo_value[rule], rule);
                $(this).next('textarea').focus().val(undo_value[rule]);
            });
            // Update the color classes now
            this_stringset.updateColors_Buttons();
            $(this).hide();
        });
    }

    // Bind the onblur autosave event
    this.bindBlurTextArea = function() {
        $('tr td textarea.translation', this.bound_table).blur(function() {
            var id;
            var textarea = $(this);
            if(textarea.hasClass('default_translation')){
              id = parseInt(textarea.attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            }else{
              id = parseInt(textarea.siblings('.default_translation').attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            }
            string = this_stringset.strings[id];
            if (string.modified) {
                /* add timeout and then submit. using the id, this timeout can be canceled */
                $.doTimeout(id.toString(), 1, function(){
                    /* push the string to server */
                    this_stringset.push(string);
                });
            }
        });
    }

    // Unbind events
    this.unbindBlurTextArea = function() {
        $('tr td textarea.translation', this.bound_table).unbind("blur");
    }
    this.unbindSaveButton = function() {
        $('tr td.notes span.save', this.bound_table).unbind("click");
    }
    this.unbindUndoButton = function() {
        $('tr td.notes span.undo', this.bound_table).unbind("click");
    }

    /* StringSet.bindStats(target_table_id) */
    this.bindStatsAndFilter = function(target_table_id) {
        table = $("table#" + target_table_id);
        this.bound_stats = table
        $('tr td input[type="checkbox"]', table).click(function(){
//            this_stringset.filter();
//            this_stringset.updateView();
        });
    };

    this.translated_modified = 0;
    this.untranslated_modified = 0;

    /* StringSet.updateStats(later=false) */
    this.updateStats = function(later) {
        later = false;
        if (later) {
            clearTimeout(this.update_stats_timer);
            this.update_stats_timer = window.setTimeout(function() { this_stringset.updateStats(); }, 1000);
        } else {
            this.modified = 0;
            for (i=0; i<this.strings.length; i++) {
                j = this.strings[i];
                if (j.modified) {
                    this.modified += 1;
                }
            }

            translated = this.translated - this.translated_modified;
            untranslated = this.untranslated - this.untranslated_modified;

            if (this.bound_stats) {
                total = translated + untranslated + this.modified;
                $('#total_sum', this.bound_stats).html(total);
                $('#total_translated', this.bound_stats).html(translated);
                $('#total_translated_perc', this.bound_stats).html(sprintf("%.02f%%", translated*100.0/total));
                $('#total_fuzzy', this.bound_stats).html(this.modified);
                $('#total_fuzzy_perc', this.bound_stats).html(sprintf("%.02f%%", this.modified*100.0/total));
                $('#total_untranslated', this.bound_stats).html(untranslated);
                $('#total_untranslated_perc', this.bound_stats).html(sprintf("%.02f%%", untranslated*100.0/total));
            }
        }
    }

    this.toolbar = function(){
        $('#stringset_table tr').mouseover(function() {
            // button panel
            var obj = $(this).find('.lotte-actions');
            pos = $(this).find("textarea.default_translation").offset();
            w = obj.width();
            obj.css({top:pos.top -4, left:pos.left - w -2});
            // show details 
            var obj2 = $(this).find('.details_trigger');
            w2 = obj2.width();
            obj2.css({top:pos.top + 60,left:pos.left - w2 -4});
        }).mouseout(function() {
            var obj = $(this).find('.lotte-actions');
            obj.css({top:-1000 ,left:-1000});
            var obj2 = $(this).find('.details_trigger');
            obj2.css({top:-1000 ,left:-1000});
        });
        
        // Bind click events for tools
        // 1.Machine translation
        if (is_supported_lang && is_supported_source_lang) {
            $('.lotte-actions a.suggest').click(function() {
                var a=$(this), str=a.html();
                a.removeClass("action");
                a.addClass("action_go");
                var orig=$('.msg .source_string', a.parents('tr')).html();
                var trans=$('textarea.default_translation', a.parents('tr'));
                orig = unescape(orig).replace(/<br\s?\/?>/g,'\n').replace(/<code>/g,'').replace(/<\/code>/g,'').replace(/&gt;/g,'>').replace(/&lt;/g,'<');
                google.language.translate(orig, source_lang, target_lang, function(result) {
                    if (!result.error) {
                        trans.val(unescape(result.translation).replace(/&#39;/g,'\'').replace(/&quot;/g,'"').replace(/%\s+(\([^\)]+\))\s*s/g,' %$1s '));
                        /* Mark the translated field as modified */
                        id = parseInt(trans.attr("id").split("_")[1]); // Get the id of current textarea -> binding index
                        string = this_stringset.strings[id];
                        string.translate(trans.val(), "other");
                        if (string.modified) {
                            trans.removeClass("fuzzy translated untranslated").addClass("fuzzy"); // Automatically set edited textarea to fuzzy
                            trans.siblings('textarea').removeClass("fuzzy translated untranslated").addClass("fuzzy");
                            // TODO: Check for autosave and handle it.
                            $('tbody tr td.notes span#save_' + id).show();
                            $('tbody tr td.notes span#undo_' + id).show();
                            trans.focus();
                        }
                    } else {
                        a.before($('<span class="alert">'+result.error.message+'</span>'));
                    }
                    a.removeClass("action_go");
                    a.addClass("action");
                });
                return false;
            });
        }else{
            $('.lotte-actions a.suggest').hide();
        }

        // 2. Copy source string
        $('.lotte-actions a.copy_source').click(function() {
            var a=$(this);
            var orig=$('.msg .source_string', a.parents('tr')).html();
            var trans=$('textarea.default_translation', a.parents('tr'));
            trans.val(orig);
            /* Mark the translated field as modified */
            id = parseInt(trans.attr("id").split("_")[1]); // Get the id of current textarea -> binding index
            string = this_stringset.strings[id];
            string.translate(trans.val(), "other");
            if (string.modified) {
                trans.removeClass("fuzzy translated untranslated").addClass("fuzzy"); // Automatically set edited textarea to fuzzy
                trans.siblings('textarea').removeClass("fuzzy translated untranslated").addClass("fuzzy");
                // TODO: Check for autosave and handle it.
                $('tbody tr td.notes span#save_' + id).show();
                $('tbody tr td.notes span#undo_' + id).show();
                trans.focus();
            }
        });

        // 3 Show details row trigger
        $('.details_trigger a').each(function(){
            $(this).click(function(){
                var nTr = $(this).parents('tr');
                var flag = $(this).hasClass('show_details');
                if(flag){
                    nTr.after('<tr class="details"><td colspan="3"><div style="text-align:center"><span class="i16 action_go">loading ...</span></div></td></tr>');
                    var icon = $('img', this);
                    src = icon.attr('src');
                    icon.attr('src', src.replace('bullet_arrow_down.png', 'bullet_arrow_up.png'));
                    $('span', this).text('hide details');
                    $(this).removeClass('show_details').addClass('hide_details');
                    var source_id = parseInt(nTr.find('.source_id').text());

                    // Get the details and inject them.
                    nTr.next(".details").load(details_url, { 'source_id' : source_id }, function(response, status, xhr) {
                      if (status == "error") {
                        var msg = "Sorry but there was an error: ";
                        alert(msg + xhr.status + " " + xhr.statusText);
                      }
                    });

                }else{
                    nTr.next('tr').remove();
                    var icon = $('img', this);
                    src = icon.attr('src');
                    icon.attr('src', src.replace('bullet_arrow_up.png', 'bullet_arrow_down.png'));
                    $('span', this).text('show details');
                    $(this).removeClass('hide_details').addClass('show_details');
                }
            });
        });

        // Bind sliding animation, and postioning for each button in the toolbar
        $('.lotte-actions p').each(function(){
            // panel buttons replacement for cross-browsing reasons
            w = $('a', this).width();
            $(this).css({right: - w - 14});
            // hover animation
            $(this).mouseenter(function(){
                $(this).animate({right:0}, {duration:'fast'});
            }).mouseleave(function() {
                w = $('a', this).width();
                $(this).animate({right: - w - 14}, {duration:'fast'});
            });
        });

    }

}


