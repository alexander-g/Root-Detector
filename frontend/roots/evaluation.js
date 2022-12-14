
// Evaluation specific operations.
var RootsEvaluation = new function () {

    // Update errormap table
    this.refresh_errormap_filetable = async function (files) {

        // Fetch errormap filetable and clear it.
        var $filetable = $('#evaluation_errormap_table tbody');
        $filetable.find('tr').remove()

        // Function for inserting a single file row.
        const insert_single_table_row = async function (i, resolve) {
            const f = files[i]

            // Needed for row menu functionality like brightness etc.
            if (!f) {
                const $after_inserts = $('after-insert-script')
                const scripts = [...(new Set($after_inserts.get().map(x => x.innerHTML.trim())))]
                scripts.map(eval)

                resolve()
                return;
            }

            // Fetch row template and append to file table.
            const $trow = $("template#errormap-filetable-row-template").tmpl([{ filename0: f.name, filename1: f.name }])
            $trow.appendTo($filetable);
            $trow.first().attr('top', $trow.offset().top)

            // Recursive call
            setTimeout(() => {
                insert_single_table_row(i + 1, resolve);
            }, 0);
        }
        return new Promise((resolve, _reject) => {
            insert_single_table_row(0, resolve)
        });
    }

    // Errormap accordion open.
    this.on_errormap_accordion_open = async function () {
        var $root = $(this)
        var $img0 = $root.find('img.left.input-image')
        var $img1 = $root.find('img.right.input-image')


        var content_already_loaded = !!$img0.attr('src') && !!$img1.attr('src')
        if (!content_already_loaded) {
            var filename0 = $root.attr('filename0');
            var filename1 = $root.attr('filename1');

            var evalfiles = RootsTraining.get_selected_evaluation_files()
            var file0 = await fetch_as_file(url_for_image(filename0))
            var file1 = await fetch_as_file(url_for_image(filename1 + '.error_map.png'))

            var promise = $img0.one('load', function () {
                $img0.siblings('svg').attr('viewBox', `0 0 ${$img0[0].naturalWidth} ${$img0[0].naturalHeight / 2}`);

            });
            $img1.one('load', async function () {
                $img1.siblings('svg').attr('viewBox', `0 0 ${$img1[0].naturalWidth} ${$img1[0].naturalHeight / 2}`);

                await promise;
                $root.find('.loading-message').remove()
                $root.find('.errormap-filetable-content').show()
            });
            GLOBAL.App.ImageLoading.set_image_src($img0, file0);
            GLOBAL.App.ImageLoading.set_image_src($img1, file1);
        }
    }



    // Displays and updates evaluation results.
    this.update_evaluation_results_info = function (NrEvalFiles, evaluationdata) {

        $('#evaluation-results-message').removeClass('hidden')
        $('#evaluation-results-box').removeClass('hidden')
        $('thead th#evaluation_errormap_files').text(`${NrEvalFiles} Evaluation Image${(NrEvalFiles == 1) ? '' : 's'} Used`)

        var old_model = evaluationdata['results_startingpoint']
        var new_model = evaluationdata['results_current']

        // PRECISION
        var n1 = Math.round(old_model['Precision'] * 10000) / 10000
        var n2 = Math.round(new_model['Precision'] * 10000) / 10000
        var n3 = Math.round((n2 - n1) * 10000) / 10000

        // Update the html labels.
        $('#evaluation-results-accuracy-label-old').text(n1)
        $('#evaluation-results-accuracy-label-new').text(n2)

        if (n3 > 0.0) {
            $('#evaluation-results-accuracy-label-comp').text("(+" + n3 + ")")
            document.getElementById("evaluation-results-accuracy-label-comp").style.color = "green"
        }
        else if (n3 < 0.0) {
            $('#evaluation-results-accuracy-label-comp').text("(" + n3 + ")")
            document.getElementById("evaluation-results-accuracy-label-comp").style.color = "red"
        }
        else {
            $('#evaluation-results-accuracy-label-comp').text("")
        }

        // F1
        n1 = Math.round(old_model['F1'] * 10000) / 10000
        n2 = Math.round(new_model['F1'] * 10000) / 10000
        n3 = Math.round((n2 - n1) * 10000) / 10000

        // Update the html labels.
        $('#evaluation-results-f1-label-old').text(n1)
        $('#evaluation-results-f1-label-new').text(n2)

        if (n3 > 0.0) {
            $('#evaluation-results-f1-label-comp').text("(+" + n3 + ")")
            document.getElementById("evaluation-results-f1-label-comp").style.color = "green"

            // Verdict text update
            $('#evaluation-results-verdict-text').text("New model is better")
            document.getElementById("evaluation-results-verdict-text").style.color = "green"
        }
        else if (n3 < 0.0) {
            $('#evaluation-results-f1-label-comp').text("(" + n3 + ")")
            document.getElementById("evaluation-results-f1-label-comp").style.color = "red"

            // Verdict text update
            $('#evaluation-results-verdict-text').text("New model is worse")
            document.getElementById("evaluation-results-verdict-text").style.color = "red"
        }
        else {
            $('#evaluation-results-f1-label-comp').text("")

            // Verdict text update
            $('#evaluation-results-verdict-text').text("New model is neither better or worse")
            document.getElementById("evaluation-results-verdict-text").style.color = "black"
        }

        // IoU
        n1 = Math.round(old_model['IoU'] * 10000) / 10000
        n2 = Math.round(new_model['IoU'] * 10000) / 10000
        n3 = Math.round((n2 - n1) * 10000) / 10000

        // Update the html labels.
        $('#evaluation-results-iou-label-old').text(n1)
        $('#evaluation-results-iou-label-new').text(n2)

        if (n3 > 0.0) {
            $('#evaluation-results-iou-label-comp').text("(+" + n3 + ")")
            document.getElementById("evaluation-results-iou-label-comp").style.color = "green"
        }
        else if (n3 < 0.0) {
            $('#evaluation-results-iou-label-comp').text("(" + n3 + ")")
            document.getElementById("evaluation-results-iou-label-comp").style.color = "red"
        } else {
            $('#evaluation-results-iou-label-comp').text("")
        }

        // RECALL
        n1 = Math.round(old_model['recall'] * 10000) / 10000
        n2 = Math.round(new_model['recall'] * 10000) / 10000
        n3 = Math.round((n2 - n1) * 10000) / 10000

        // Update the html labels.
        $('#evaluation-results-recall-label-old').text(n1)
        $('#evaluation-results-recall-label-new').text(n2)

        if (n3 > 0.0) {
            $('#evaluation-results-recall-label-comp').text("(+" + n3 + ")")
            document.getElementById("evaluation-results-recall-label-comp").style.color = "green"
        }
        else if (n3 < 0.0) {
            $('#evaluation-results-recall-label-comp').text("(" + n3 + ")")
            document.getElementById("evaluation-results-recall-label-comp").style.color = "red"
        }
        else {
            $('#evaluation-results-recall-label-comp').text("")
        }
    }
};